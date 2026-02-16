import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Organization, type OrganizationDocument } from './organization.schema';
import { OrganizationTypeGql } from './organization.entity';
import type { OrganizationSuggestionEntity } from './organization.entity';
import type { SetMyWorkPlaceManualInput } from './organization.input';
import { DadataPartyService } from './dadata-party.service';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectModel(Organization.name)
    private readonly organizationModel: Model<OrganizationDocument>,
    private readonly dadataPartyService: DadataPartyService,
  ) {}

  private buildUniqueKey(params: {
    type: OrganizationTypeGql;
    inn: string;
    kpp?: string;
  }): string {
    return `${params.type}:${params.inn}:${params.kpp ?? ''}`;
  }

  async findById(id: string): Promise<OrganizationDocument> {
    const org = await this.organizationModel.findById(id);
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  /**
   * Обновить только банковские реквизиты организации (например, при оформлении заказа).
   */
  async setBankDetails(
    organizationId: string,
    details: {
      bankAccount?: string;
      bankName?: string;
      bik?: string;
      correspondentAccount?: string;
    },
  ): Promise<OrganizationDocument> {
    await this.findById(organizationId);
    const update: Record<string, string | undefined> = {};
    if (details.bankAccount !== undefined) {
      update.bankAccount = this.assertBankAccount(details.bankAccount);
    }
    if (details.bankName !== undefined) {
      update.bankName =
        typeof details.bankName === 'string' && details.bankName.trim()
          ? details.bankName.trim().slice(0, 300)
          : undefined;
    }
    if (details.bik !== undefined) {
      update.bik = this.assertBik(details.bik);
    }
    if (details.correspondentAccount !== undefined) {
      update.correspondentAccount = this.assertCorrespondentAccount(
        details.correspondentAccount,
      );
    }
    if (Object.keys(update).length === 0) return this.findById(organizationId);
    const cleaned = Object.fromEntries(
      Object.entries(update).filter(([, v]) => v != null),
    ) as Partial<Organization>;
    const org = await this.organizationModel.findByIdAndUpdate(
      organizationId,
      { $set: cleaned },
      { new: true },
    );
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async findByInn(
    params: { inn: string; kpp?: string },
  ): Promise<OrganizationDocument | null> {
    const inn = params.inn.trim();
    const kpp = typeof params.kpp === 'string' ? params.kpp.trim() : undefined;

    // Try LEGAL by inn+kpp first if kpp exists, else fall back by inn
    if (kpp) {
      const org = await this.organizationModel.findOne({
        inn,
        type: 'LEGAL',
        kpp,
      });
      if (org) return org;
    }

    return this.organizationModel.findOne({ inn });
  }

  /**
   * Найти организацию по запросу: ИНН (10/12 цифр) или наименование.
   * Логика как в organizationSuggestions: по цифрам — по ИНН, иначе по названию; при отсутствии в БД — DaData suggest + upsert.
   */
  async findOrCreateByQuery(params: {
    query: string;
    ip?: string;
  }): Promise<OrganizationDocument | null> {
    const q = params.query.trim();
    if (!q) return null;

    const digits = this.normalizeDigits(q);
    const isInnQuery = digits.length === 10 || digits.length === 12;

    if (isInnQuery) {
      return this.findOrCreateByInn({ inn: q, ip: params.ip });
    }

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const local = await this.organizationModel
      .find({
        displayName: { $regex: escaped, $options: 'i' },
      })
      .limit(1)
      .sort({ syncedAt: -1 })
      .exec();
    if (local[0]) return local[0];

    const suggestions = await this.dadataPartyService.suggest({
      query: q,
      count: 5,
      ip: params.ip,
    });
    const picked = suggestions[0] ?? null;
    if (!picked) return null;

    return this.upsertFromSuggestion(picked);
  }

  /**
   * Найти организацию по ИНН в БД или создать из DaData. Используется внутри findOrCreateByQuery и в setMyWorkPlaceByInn-сценариях.
   */
  private async findOrCreateByInn(params: {
    inn: string;
    kpp?: string;
    ip?: string;
  }): Promise<OrganizationDocument | null> {
    const innRaw = params.inn.trim();
    const innDigits = this.normalizeDigits(innRaw);
    if (!(innDigits.length === 10 || innDigits.length === 12)) {
      return null;
    }
    const kpp =
      typeof params.kpp === 'string' && params.kpp.trim()
        ? this.normalizeDigits(params.kpp.trim())
        : undefined;
    if (kpp !== undefined && kpp.length !== 9) return null;

    const fromDb = await this.findByInn({
      inn: innDigits,
      kpp: kpp || undefined,
    });
    if (fromDb) return fromDb;

    const suggestions = await this.dadataPartyService.suggest({
      query: innRaw,
      count: 10,
      ip: params.ip,
    });
    const picked =
      suggestions.find(
        (s) => s.inn === innDigits && (kpp ? s.kpp === kpp : true),
      ) ?? suggestions.find((s) => s.inn === innDigits);
    if (!picked) return null;

    return this.upsertFromSuggestion(picked);
  }

  async searchLocalSuggestions(params: {
    query: string;
    limit: number;
  }): Promise<OrganizationSuggestionEntity[]> {
    const q = params.query.trim();
    if (!q) return [];

    const limit = Math.min(10, Math.max(1, Math.trunc(params.limit)));
    const digits = q.replace(/\D+/g, '');
    const isInnQuery = digits.length === 10 || digits.length === 12;

    const docs = isInnQuery
      ? await this.organizationModel
          .find({ inn: { $regex: `^${digits}` } })
          .limit(limit)
          .sort({ syncedAt: -1 })
      : await this.organizationModel
          .find({
            displayName: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
          })
          .limit(limit)
          .sort({ syncedAt: -1 });

    return docs.map((d) => ({
      type: d.type === 'INDIVIDUAL' ? OrganizationTypeGql.INDIVIDUAL : OrganizationTypeGql.LEGAL,
      inn: d.inn,
      kpp: d.kpp,
      ogrn: d.ogrn,
      displayName: d.displayName,
      fullName: d.fullName,
      shortName: d.shortName,
      legalAddress: d.legalAddress,
    }));
  }

  async upsertFromSuggestion(
    s: OrganizationSuggestionEntity,
  ): Promise<OrganizationDocument> {
    const uniqueKey = this.buildUniqueKey({
      type: s.type,
      inn: s.inn,
      kpp: s.kpp,
    });

    const now = new Date();
    const update: Partial<Organization> = {
      uniqueKey,
      type: s.type,
      inn: s.inn,
      kpp: s.kpp,
      ogrn: s.ogrn,
      displayName: s.displayName,
      ...(s.fullName && { fullName: s.fullName }),
      ...(s.shortName && { shortName: s.shortName }),
      legalAddress: s.legalAddress,
      actualAddress: s.legalAddress,
      source: 'dadata',
      syncedAt: now,
    };

    const org = await this.organizationModel.findOneAndUpdate(
      { uniqueKey },
      { $set: update },
      { upsert: true, new: true },
    );

    return org;
  }

  private normalizeDigits(value: string): string {
    return value.replace(/\D+/g, '');
  }

  private assertInn(inn: string): string {
    const v = this.normalizeDigits(inn);
    if (!(v.length === 10 || v.length === 12)) {
      throw new BadRequestException('INN must be 10 (LEGAL) or 12 (IP) digits');
    }
    return v;
  }

  private assertKpp(kpp: string | undefined): string | undefined {
    if (kpp === undefined) return undefined;
    const v = this.normalizeDigits(kpp);
    if (v.length !== 9) {
      throw new BadRequestException('KPP must be 9 digits');
    }
    return v;
  }

  private assertOgrn(ogrn: string, type: OrganizationTypeGql): string {
    const v = this.normalizeDigits(ogrn);
    const expected = type === OrganizationTypeGql.INDIVIDUAL ? 15 : 13;
    if (v.length !== expected) {
      throw new BadRequestException(
        type === OrganizationTypeGql.INDIVIDUAL
          ? 'OGRNIP must be 15 digits'
          : 'OGRN must be 13 digits',
      );
    }
    return v;
  }

  private assertBik(value: string | undefined): string | undefined {
    if (value === undefined || !value.trim()) return undefined;
    const v = this.normalizeDigits(value);
    if (v.length !== 9) {
      throw new BadRequestException('БИК должен содержать 9 цифр');
    }
    return v;
  }

  private assertBankAccount(value: string | undefined): string | undefined {
    if (value === undefined || !value.trim()) return undefined;
    const v = this.normalizeDigits(value);
    if (v.length !== 20) {
      throw new BadRequestException('Расчётный счёт (р/с) должен содержать 20 цифр');
    }
    return v;
  }

  private assertCorrespondentAccount(value: string | undefined): string | undefined {
    if (value === undefined || !value.trim()) return undefined;
    const v = this.normalizeDigits(value);
    if (v.length !== 20) {
      throw new BadRequestException('Корреспондентский счёт (к/с) должен содержать 20 цифр');
    }
    return v;
  }

  async upsertManual(input: SetMyWorkPlaceManualInput): Promise<OrganizationDocument> {
    const type = input.type;
    const inn = this.assertInn(input.inn);
    const kpp = type === OrganizationTypeGql.LEGAL ? this.assertKpp(input.kpp) : undefined;
    const ogrn = this.assertOgrn(input.ogrn, type);

    const uniqueKey = this.buildUniqueKey({ type, inn, kpp });

    const existing = await this.organizationModel.findOne({ uniqueKey });

    const fioFull =
      typeof input.fioFull === 'string' && input.fioFull.trim()
        ? input.fioFull.trim()
        : [input.fioLast, input.fioFirst, input.fioMiddle]
            .map((x) => (typeof x === 'string' ? x.trim() : ''))
            .filter(Boolean)
            .join(' ') || undefined;

    const displayName =
      typeof input.displayName === 'string' && input.displayName.trim()
        ? input.displayName.trim()
        : type === OrganizationTypeGql.INDIVIDUAL
          ? fioFull
            ? `ИП ${fioFull}`
            : inn
          : (typeof input.shortName === 'string' && input.shortName.trim()
              ? input.shortName.trim()
              : typeof input.fullName === 'string' && input.fullName.trim()
                ? input.fullName.trim()
                : inn);

    const legalAddress =
      typeof input.legalAddress === 'string' && input.legalAddress.trim()
        ? input.legalAddress.trim()
        : undefined;

    const actualAddressRaw =
      typeof input.actualAddress === 'string' && input.actualAddress.trim()
        ? input.actualAddress.trim()
        : undefined;

    const actualAddress =
      input.actualSameAsLegal === true ? legalAddress : actualAddressRaw ?? legalAddress;

    const update: Partial<Organization> = {
      uniqueKey,
      type,
      inn,
      kpp,
      ogrn,
      displayName,

      fullName:
        type === OrganizationTypeGql.LEGAL &&
        typeof input.fullName === 'string' &&
        input.fullName.trim()
          ? input.fullName.trim()
          : undefined,
      shortName:
        type === OrganizationTypeGql.LEGAL &&
        typeof input.shortName === 'string' &&
        input.shortName.trim()
          ? input.shortName.trim()
          : undefined,
      opfFull:
        type === OrganizationTypeGql.LEGAL &&
        typeof input.opfFull === 'string' &&
        input.opfFull.trim()
          ? input.opfFull.trim()
          : undefined,
      opfShort:
        type === OrganizationTypeGql.LEGAL &&
        typeof input.opfShort === 'string' &&
        input.opfShort.trim()
          ? input.opfShort.trim()
          : undefined,

      fioLast:
        type === OrganizationTypeGql.INDIVIDUAL &&
        typeof input.fioLast === 'string' &&
        input.fioLast.trim()
          ? input.fioLast.trim()
          : undefined,
      fioFirst:
        type === OrganizationTypeGql.INDIVIDUAL &&
        typeof input.fioFirst === 'string' &&
        input.fioFirst.trim()
          ? input.fioFirst.trim()
          : undefined,
      fioMiddle:
        type === OrganizationTypeGql.INDIVIDUAL &&
        typeof input.fioMiddle === 'string' &&
        input.fioMiddle.trim()
          ? input.fioMiddle.trim()
          : undefined,
      fioFull: type === OrganizationTypeGql.INDIVIDUAL ? fioFull : undefined,

      legalAddress,
      actualAddress,

      bankAccount: this.assertBankAccount(input.bankAccount),
      bankName:
        typeof input.bankName === 'string' && input.bankName.trim()
          ? input.bankName.trim().slice(0, 300)
          : undefined,
      bik: this.assertBik(input.bik),
      correspondentAccount: this.assertCorrespondentAccount(input.correspondentAccount),

      email:
        typeof input.email === 'string' && input.email.trim()
          ? input.email.trim()
          : undefined,
      phone:
        typeof input.phone === 'string' && input.phone.trim()
          ? input.phone.trim()
          : undefined,

      // Do not overwrite a DaData-synced record's source.
      source: existing?.source === 'dadata' ? 'dadata' : 'manual',
      syncedAt: existing?.syncedAt,
    };

    const now = new Date();
    if (update.source === 'manual') {
      update.syncedAt = now;
    }

    const org = await this.organizationModel.findOneAndUpdate(
      { uniqueKey },
      { $set: update },
      { upsert: true, new: true },
    );

    return org;
  }
}

