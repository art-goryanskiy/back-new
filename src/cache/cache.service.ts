import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redisClient: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.redisClient = new Redis({
      host: this.configService.get<string>('REDIS_HOST') || 'localhost',
      port: this.configService.get<number>('REDIS_PORT') || 6379,
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.redisClient.on('connect', () => {
      this.logger.log('Connected to Redis');
    });

    this.redisClient.on('error', (error) => {
      this.logger.error('Redis error', error);
    });
  }

  onModuleDestroy() {
    this.redisClient?.disconnect();
  }

  // Восстанавливает Date объекты из JSON
  private reviveDates(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.reviveDates(item));
    }

    if (typeof obj === 'object') {
      if (obj instanceof Date) {
        return obj;
      }

      const revived: Record<string, unknown> = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const value = (obj as Record<string, unknown>)[key];

          if (
            typeof value === 'string' &&
            (key === 'createdAt' ||
              key === 'updatedAt' ||
              /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(value))
          ) {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              revived[key] = date;
            } else {
              revived[key] = value;
            }
          } else {
            revived[key] = this.reviveDates(value);
          }
        }
      }
      return revived;
    }

    return obj;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redisClient.get(key);
      if (!value) {
        return null;
      }
      const parsed: unknown = JSON.parse(value);
      return this.reviveDates(parsed) as T;
    } catch (error) {
      this.logger.error('Error getting value from Redis', error);
      return null;
    }
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      const defaultTtl = this.configService.get<number>('REDIS_TTL') || 3600;
      const expireTime = ttl || defaultTtl;
      await this.redisClient.setex(key, expireTime, serialized);
    } catch (error) {
      this.logger.error('Error setting value in Redis', error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redisClient.del(key);
    } catch (error) {
      this.logger.error(`Error deleting key ${key}:`, error);
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    try {
      const keys: string[] = [];
      let cursor = '0';

      // Используем SCAN вместо KEYS для неблокирующей операции
      do {
        const result = await this.redisClient.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = result[0];
        keys.push(...result[1]);
      } while (cursor !== '0');

      if (keys.length > 0) {
        // Удаляем батчами по 100 ключей для оптимизации
        const batchSize = 100;
        for (let i = 0; i < keys.length; i += batchSize) {
          const batch = keys.slice(i, i + batchSize);
          await this.redisClient.del(...batch);
        }
        this.logger.log(
          `Deleted ${keys.length} keys matching pattern: ${pattern}`,
        );
      }
    } catch (error) {
      this.logger.error(`Error deleting keys by pattern ${pattern}:`, error);
    }
  }

  // NEW: атомарный счётчик с TTL (для rate limiting)
  async incrWithTtl(key: string, ttlSeconds: number): Promise<number | null> {
    try {
      const current = await this.redisClient.incr(key);
      if (current === 1) {
        await this.redisClient.expire(key, ttlSeconds);
      }
      return current;
    } catch (error) {
      this.logger.error(`Error incrWithTtl for key ${key}`, error);
      return null;
    }
  }
}
