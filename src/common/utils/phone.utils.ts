const RU_PHONE_REGEX = /^(\+7)([0-9]){10}$/;

/**
 * Нормализует российский номер телефона к формату +7XXXXXXXXXX.
 * Возвращает undefined, если номер не удалось привести к нужному формату.
 */
export function normalizeRuPhone(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let phone = raw.trim();
  if (!phone) return undefined;

  if (!phone.startsWith('+')) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) phone = `+7${digits}`;
    else if (digits.length === 11 && digits.startsWith('7'))
      phone = `+7${digits.slice(1)}`;
  }

  return RU_PHONE_REGEX.test(phone) ? phone : undefined;
}
