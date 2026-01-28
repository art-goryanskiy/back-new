/**
 * Утилита для преобразования ObjectId в строку
 */
export function objectIdToString(value: unknown): string | undefined {
  if (typeof value === 'string' && value) return value;
  const maybe = value as { toString?: () => string } | null | undefined;
  const s = maybe?.toString?.();
  return typeof s === 'string' && s ? s : undefined;
}

/**
 * Утилита для извлечения ID из документа (поддерживает и id, и _id)
 */
export function extractId(entity: { id?: unknown; _id?: unknown }): string {
  if (typeof entity.id === 'string' && entity.id) return entity.id;
  const maybe = entity._id as { toString?: () => string } | string | undefined;
  const fromObjectId = typeof maybe === 'string' ? maybe : maybe?.toString?.();
  if (fromObjectId) return fromObjectId;
  throw new Error('Entity id is missing');
}
