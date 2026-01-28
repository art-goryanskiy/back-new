import { BadRequestException } from '@nestjs/common';

export class UserValidators {
  /**
   * Нормализует и валидирует email
   */
  static normalizeEmail(email: unknown): string {
    if (typeof email !== 'string') {
      throw new BadRequestException('Email is required');
    }
    const v = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      throw new BadRequestException('Invalid email');
    }
    return v;
  }

  /**
   * Нормализует и валидирует пароль
   */
  static normalizePassword(password: unknown): string {
    if (typeof password !== 'string') {
      throw new BadRequestException('Password is required');
    }
    const v = password.trim();
    if (v.length < 6) {
      throw new BadRequestException('Password too short (min 6)');
    }
    return v;
  }

  /**
   * Нормализует и валидирует телефон (опционально)
   */
  static normalizeOptionalPhone(phone: unknown): string | undefined {
    if (phone == null) return undefined;
    if (typeof phone !== 'string') {
      throw new BadRequestException('Invalid phone');
    }
    const v = phone.trim();
    if (v && !/^[\d+()\-\s]{6,30}$/.test(v)) {
      throw new BadRequestException('Invalid phone');
    }
    return v || undefined;
  }

  /**
   * Нормализует и валидирует СНИЛС (опционально)
   */
  static normalizeOptionalSnils(snils: unknown): string | undefined {
    if (snils == null) return undefined;
    if (typeof snils !== 'string')
      throw new BadRequestException('Invalid SNILS');

    const digits = snils.replace(/\D/g, '');
    if (!digits) return undefined;
    if (digits.length !== 11) throw new BadRequestException('Invalid SNILS');

    const base = digits.slice(0, 9);
    const control = parseInt(digits.slice(9), 10);

    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(base[i], 10) * (9 - i);
    }

    let calc = 0;
    if (sum < 100) calc = sum;
    else if (sum === 100 || sum === 101) calc = 0;
    else {
      calc = sum % 101;
      if (calc === 100) calc = 0;
    }

    if (calc !== control) throw new BadRequestException('Invalid SNILS');

    return digits;
  }
}
