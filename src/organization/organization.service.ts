import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Organization, type OrganizationDocument } from './organization.schema';
import { OrganizationTypeGql } from './organization.entity';
import type { OrganizationSuggestionEntity } from './organization.entity';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectModel(Organization.name)
    private readonly organizationModel: Model<OrganizationDocument>,
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
      legalAddress: s.legalAddress,
      actualAddress: s.legalAddress,
      source: 'dadata',
      syncedAt: now,
    };

    const org = await this.organizationModel.findOneAndUpdate(
      { uniqueKey },
      { $set: update, $setOnInsert: { uniqueKey } },
      { upsert: true, new: true },
    );

    return org;
  }
}

