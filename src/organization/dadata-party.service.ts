import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from 'src/cache/cache.service';
import { sha256 } from 'src/common/utils/crypto.utils';

import { OrganizationTypeGql } from './organization.entity';
import type { OrganizationSuggestionEntity } from './organization.entity';

type DadataPartyResponse = {
  suggestions?: Array<{
    value?: string;
    data?: Record<string, unknown>;
  }>;
};

const DADATA_SUGGEST_PARTY_URL =
  'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/party';

@Injectable()
export class DadataPartyService {
  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {}

  private getTokenOrThrow(): string {
    const token = this.configService.get<string>('DADATA_TOKEN');
    if (typeof token !== 'string' || !token.trim()) {
      throw new Error('DADATA_TOKEN is not set');
    }
    return token.trim();
  }

  private async enforceRateLimit(ip?: string): Promise<void> {
    const key = `dadata:party:rl:${ip || 'unknown'}`;
    const n = await this.cacheService.incrWithTtl(key, 60);
    if (n != null && n > 60) {
      throw new HttpException('Too many organization suggestion requests', 429);
    }
  }

  private normalizeQuery(q: string): string {
    return q.replace(/\s+/g, ' ').trim();
  }

  private clampCount(count?: number): number {
    if (typeof count !== 'number' || !Number.isFinite(count)) return 10;
    const c = Math.trunc(count);
    return Math.min(10, Math.max(1, c));
  }

  private digitsOnly(s: string): string {
    return s.replace(/\D+/g, '');
  }

  private getStr(obj: Record<string, unknown>, path: string): string | undefined {
    const parts = path.split('.');
    let cur: unknown = obj;
    for (const p of parts) {
      if (!cur || typeof cur !== 'object') return undefined;
      cur = (cur as Record<string, unknown>)[p];
    }
    return typeof cur === 'string' && cur.trim() ? cur.trim() : undefined;
  }

  private toSuggestion(raw: {
    value?: string;
    data?: Record<string, unknown>;
  }): OrganizationSuggestionEntity | null {
    const data = raw.data ?? {};
    const inn = this.getStr(data, 'inn');
    const ogrn = this.getStr(data, 'ogrn');
    const typeRaw = this.getStr(data, 'type'); // "LEGAL" / "INDIVIDUAL"

    if (!inn || !ogrn) return null;

    const type: OrganizationTypeGql =
      typeRaw === 'INDIVIDUAL'
        ? OrganizationTypeGql.INDIVIDUAL
        : OrganizationTypeGql.LEGAL;

    const kpp = this.getStr(data, 'kpp');

    // names
    const fullWithOpf = this.getStr(data, 'name.full_with_opf');
    const shortWithOpf = this.getStr(data, 'name.short_with_opf');
    const fioSurname = this.getStr(data, 'fio.surname');
    const fioName = this.getStr(data, 'fio.name');
    const fioPatronymic = this.getStr(data, 'fio.patronymic');

    const fioFull =
      type === OrganizationTypeGql.INDIVIDUAL
        ? [fioSurname, fioName, fioPatronymic].filter(Boolean).join(' ')
        : undefined;

    const displayName =
      type === OrganizationTypeGql.INDIVIDUAL
        ? (fioFull ? `ИП ${fioFull}` : raw.value?.trim() || inn)
        : (shortWithOpf || fullWithOpf || raw.value?.trim() || inn);

    const legalAddress =
      this.getStr(data, 'address.value') ??
      this.getStr(data, 'address.unrestricted_value');

    const fullName =
      type === OrganizationTypeGql.LEGAL && fullWithOpf ? fullWithOpf : undefined;
    const shortName =
      type === OrganizationTypeGql.LEGAL && shortWithOpf ? shortWithOpf : undefined;

    return {
      type,
      inn,
      kpp: type === OrganizationTypeGql.LEGAL ? kpp : undefined,
      ogrn,
      displayName,
      fullName,
      shortName,
      legalAddress,
    };
  }

  async suggest(params: {
    query: string;
    count?: number;
    ip?: string;
  }): Promise<OrganizationSuggestionEntity[]> {
    const query = this.normalizeQuery(params.query);
    if (query.length < 2) return [];

    const count = this.clampCount(params.count);
    await this.enforceRateLimit(params.ip);

    const digits = this.digitsOnly(query);
    const cacheKey = `dadata:party:suggest:${sha256(
      JSON.stringify({ q: query, c: count }),
    )}`;
    const cached =
      await this.cacheService.get<OrganizationSuggestionEntity[]>(cacheKey);
    if (cached) return cached;

    const token = this.getTokenOrThrow();

    const body: Record<string, unknown> = { query, count };
    // If user enters INN-like query, prefer active companies by INN quickly.
    if (digits.length === 10 || digits.length === 12) {
      body.query = digits;
    }

    const res = await fetch(DADATA_SUGGEST_PARTY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Token ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new BadRequestException(
        `DaData error: ${res.status} ${res.statusText}${
          text ? ` (${text.slice(0, 200)})` : ''
        }`,
      );
    }

    const json = (await res.json()) as DadataPartyResponse;
    const suggestions = Array.isArray(json.suggestions) ? json.suggestions : [];

    const mapped = suggestions
      .map((s) => this.toSuggestion(s))
      .filter((s): s is OrganizationSuggestionEntity => s !== null);

    await this.cacheService.set(cacheKey, mapped, 60 * 60); // 1 hour
    return mapped;
  }
}

