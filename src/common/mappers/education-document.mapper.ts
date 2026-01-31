import type { EducationDocumentDocument } from 'src/education-document/education-document.schema';
import type { EducationDocumentEntity } from 'src/education-document/education-document.entity';
import { extractId } from './base.mapper';

export function toEducationDocumentEntity(
  doc: EducationDocumentDocument | null,
): EducationDocumentEntity | null {
  if (!doc) return null;

  const obj = doc.toObject();
  const withTimestamps = obj as typeof obj & {
    createdAt?: Date;
    updatedAt?: Date;
  };

  return {
    id: extractId(doc),
    name: doc.name,
    image: doc.image,
    createdAt: withTimestamps.createdAt ?? new Date(),
    updatedAt: withTimestamps.updatedAt ?? new Date(),
  };
}

export function toEducationDocumentEntityArray(
  docs: EducationDocumentDocument[],
): EducationDocumentEntity[] {
  return docs
    .map(toEducationDocumentEntity)
    .filter((e): e is EducationDocumentEntity => e !== null);
}
