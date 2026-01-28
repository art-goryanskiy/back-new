import crypto from 'crypto';

/**
 * Создает SHA256 хэш из строки
 */
export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
