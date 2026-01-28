import type { CacheService } from 'src/cache/cache.service';

export async function allowEmailSend(
  cacheService: CacheService,
  action: 'register' | 'resend',
  email: string,
  ip?: string,
): Promise<boolean> {
  const emailKey = `rl:${action}:email:${email}`;
  const ipKey = ip ? `rl:${action}:ip:${ip}` : null;

  // 1 письмо / 60 сек на email
  const emailHits = await cacheService.incrWithTtl(emailKey, 60);
  if (emailHits !== null && emailHits > 1) return false;

  // 5 писем / 10 мин на IP
  if (ipKey) {
    const ipHits = await cacheService.incrWithTtl(ipKey, 10 * 60);
    if (ipHits !== null && ipHits > 5) return false;
  }

  return true;
}
