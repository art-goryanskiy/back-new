import { BadRequestException } from '@nestjs/common';

export function validatePricing(
  pricing: Array<{ hours: number; price: number }> | undefined,
): void {
  if (!pricing || pricing.length === 0) {
    throw new BadRequestException('Pricing array must not be empty');
  }

  for (const item of pricing) {
    if (item.hours <= 0 || item.price <= 0) {
      throw new BadRequestException('Hours and price must be positive numbers');
    }
  }

  const hours = pricing.map((p) => p.hours);
  if (new Set(hours).size !== hours.length) {
    throw new BadRequestException('Pricing hours must be unique');
  }
}

export function normalizeAwardedQualification(
  value: unknown,
): string | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  return v.length ? v : undefined;
}

function normalizeInt(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.trunc(value);
}

export function validateAwardedRankRange(
  from: unknown,
  to: unknown,
): { from: number; to: number } {
  const f = normalizeInt(from);
  const t = normalizeInt(to);

  if (f === undefined || t === undefined) {
    throw new BadRequestException('Awarded rank range (from/to) is required');
  }
  if (f <= 0 || t <= 0) {
    throw new BadRequestException('Awarded ranks must be positive integers');
  }
  if (t < f) {
    throw new BadRequestException('AwardedRankTo must be >= AwardedRankFrom');
  }
  return { from: f, to: t };
}

export function normalizeSubPrograms(
  value: unknown,
): Array<{ title: string; description?: string }> | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new BadRequestException('subPrograms must be an array');
  }

  const normalized = value.map((sp, idx) => {
    const obj = sp as Record<string, unknown>;
    const title = typeof obj.title === 'string' ? obj.title.trim() : '';
    if (!title) {
      throw new BadRequestException(`subPrograms[${idx}].title is required`);
    }

    const description =
      typeof obj.description === 'string' ? obj.description.trim() : undefined;

    return {
      title,
      description: description && description.length ? description : undefined,
    };
  });

  const titles = normalized.map((x) => x.title.toLowerCase());
  if (new Set(titles).size !== titles.length) {
    throw new BadRequestException('subPrograms titles must be unique');
  }

  if (normalized.length > 100) {
    throw new BadRequestException('Too many subPrograms (max 100)');
  }

  return normalized;
}
