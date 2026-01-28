/**
 * Удаляет все undefined значения из объекта
 */
export function cleanUndefined(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...obj };
  for (const k of Object.keys(copy)) {
    if (copy[k] === undefined) delete copy[k];
  }
  return copy;
}
