import {
  BadRequestException,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from 'src/cache/cache.service';
import { sha256 } from 'src/common/utils/crypto.utils';

import type { AddressSuggestionEntity } from '../gql/user.entity';

type DadataSuggestAddressResponse = {
  suggestions?: Array<{
    value?: string;
    unrestricted_value?: string;
    data?: Record<string, unknown>;
  }>;
};

const DADATA_SUGGEST_ADDRESS_URL =
  'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address';

@Injectable()
export class DadataAddressService {
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
    // default: 60 requests / minute per IP
    const key = `dadata:addr:rl:${ip || 'unknown'}`;
    const n = await this.cacheService.incrWithTtl(key, 60);
    if (n != null && n > 60) {
      throw new HttpException('Too many address suggestion requests', 429);
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

  private toSuggestion(s: {
    value?: string;
    unrestricted_value?: string;
    data?: Record<string, unknown>;
  }): AddressSuggestionEntity | null {
    const value = typeof s.value === 'string' ? s.value.trim() : '';
    if (!value) return null;

    const data = s.data ?? {};
    const getStr = (k: string): string | undefined => {
      const v = data[k];
      return typeof v === 'string' && v.trim() ? v.trim() : undefined;
    };

    return {
      value,
      unrestrictedValue:
        typeof s.unrestricted_value === 'string' && s.unrestricted_value.trim()
          ? s.unrestricted_value.trim()
          : undefined,
      postalCode: getStr('postal_code'),
      region: getStr('region') ?? getStr('region_with_type'),
      city: getStr('city') ?? getStr('city_with_type'),
      street: getStr('street') ?? getStr('street_with_type'),
      house: getStr('house'),
      flat: getStr('flat'),
      fiasId: getStr('fias_id') ?? getStr('fias_house_id'),
      kladrId: getStr('kladr_id'),
      geoLat: getStr('geo_lat'),
      geoLon: getStr('geo_lon'),
    };
  }

  private isCrimeaPreferred(s: AddressSuggestionEntity): boolean {
    const region = (s.region ?? '').toLowerCase();
    if (region.includes('крым')) return true;
    if (region.includes('севастоп')) return true;

    const kladr = (s.kladrId ?? '').trim();
    // Crimea: 91..., Sevastopol: 92... (KLADR region codes)
    if (kladr.startsWith('91') || kladr.startsWith('92')) return true;

    return false;
  }

  async suggestAddress(params: {
    query: string;
    count?: number;
    ip?: string;
  }): Promise<AddressSuggestionEntity[]> {
    const query = this.normalizeQuery(params.query);
    if (query.length < 3) return [];

    const count = this.clampCount(params.count);

    await this.enforceRateLimit(params.ip);

    const cacheKey = `dadata:addr:suggest:${sha256(
      JSON.stringify({ q: query, c: count }),
    )}`;
    const cached = await this.cacheService.get<AddressSuggestionEntity[]>(
      cacheKey,
    );
    if (cached) return cached;

    const token = this.getTokenOrThrow();

    const res = await fetch(DADATA_SUGGEST_ADDRESS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Token ${token}`,
      },
      body: JSON.stringify({ query, count }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new BadRequestException(
        `DaData error: ${res.status} ${res.statusText}${
          text ? ` (${text.slice(0, 200)})` : ''
        }`,
      );
    }

    const json = (await res.json()) as DadataSuggestAddressResponse;
    const suggestions = Array.isArray(json.suggestions) ? json.suggestions : [];

    const mapped = suggestions
      .map((s) => this.toSuggestion(s))
      .filter((s): s is AddressSuggestionEntity => s !== null);

    // prefer Crimea results
    mapped.sort((a, b) => Number(this.isCrimeaPreferred(b)) - Number(this.isCrimeaPreferred(a)));

    await this.cacheService.set(cacheKey, mapped, 60 * 60); // 1 hour
    return mapped;
  }
}

