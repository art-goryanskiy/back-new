import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type OrganizationDocument = HydratedDocument<Organization>;

export type OrganizationType = 'LEGAL' | 'INDIVIDUAL';

@Schema({ timestamps: true })
export class Organization {
  /**
   * Unique key to avoid nullable-field unique index issues:
   * `${type}:${inn}:${kpp||''}`
   */
  @Prop({ required: true, unique: true })
  uniqueKey: string;

  @Prop({ required: true, enum: ['LEGAL', 'INDIVIDUAL'] })
  type: OrganizationType;

  @Prop({ required: true })
  inn: string;

  @Prop()
  kpp?: string;

  @Prop({ required: true })
  ogrn: string; // for INDIVIDUAL this is OGRNIP

  @Prop({ required: true })
  displayName: string;

  // LEGAL fields
  @Prop()
  fullName?: string;

  @Prop()
  shortName?: string;

  @Prop()
  opfFull?: string;

  @Prop()
  opfShort?: string;

  // INDIVIDUAL fields
  @Prop()
  fioLast?: string;

  @Prop()
  fioFirst?: string;

  @Prop()
  fioMiddle?: string;

  @Prop()
  fioFull?: string;

  // Addresses
  @Prop()
  legalAddress?: string;

  @Prop()
  actualAddress?: string;

  // Contacts (often отсутствуют в реестрах — заполняются вручную)
  @Prop()
  email?: string;

  @Prop()
  phone?: string;

  @Prop({ required: true, enum: ['dadata', 'manual'] })
  source: 'dadata' | 'manual';

  @Prop()
  syncedAt?: Date;

  // raw provider payload for future needs (optional)
  @Prop({ type: Object })
  dadataRaw?: Record<string, unknown>;
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);

OrganizationSchema.index({ inn: 1, type: 1 });
OrganizationSchema.index({ ogrn: 1 });
OrganizationSchema.index({ displayName: 1 });
