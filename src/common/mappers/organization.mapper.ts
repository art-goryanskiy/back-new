import type { OrganizationDocument } from 'src/organization/organization.schema';
import {
  OrganizationEntity,
  OrganizationTypeGql,
} from 'src/organization/organization.entity';
import { extractId } from './base.mapper';

export function toOrganizationEntity(
  org: OrganizationDocument | null,
): OrganizationEntity | null {
  if (!org) return null;

  return {
    id: extractId(org),
    type:
      org.type === 'INDIVIDUAL'
        ? OrganizationTypeGql.INDIVIDUAL
        : OrganizationTypeGql.LEGAL,
    inn: org.inn,
    kpp: org.kpp,
    ogrn: org.ogrn,
    displayName: org.displayName,
    fullName: org.fullName,
    shortName: org.shortName,
    opfFull: org.opfFull,
    opfShort: org.opfShort,
    fioLast: org.fioLast,
    fioFirst: org.fioFirst,
    fioMiddle: org.fioMiddle,
    fioFull: org.fioFull,
    legalAddress: org.legalAddress,
    actualAddress: org.actualAddress,
    email: org.email,
    phone: org.phone,
  };
}
