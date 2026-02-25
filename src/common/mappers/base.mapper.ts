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
