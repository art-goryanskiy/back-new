import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from 'src/cache/cache.service';
import type { NewsItemEntity } from './news.entity';
import type { NewsFilterInput } from './news.input';

const VK_API_BASE = 'https://api.vk.com/method';
const NEWS_CACHE_TTL = 600; // 10 минут

type VkSize = { url?: string; width?: number; height?: number; type?: string };
type VkPhoto = { sizes?: VkSize[] };
type VkVideo = { image?: VkSize[]; first_frame?: VkSize[] };
type VkLink = { url?: string; title?: string };
type VkAttachment = {
  type: string;
  photo?: VkPhoto;
  video?: VkVideo;
  link?: VkLink;
};
type VkWallItem = {
  id: number;
  owner_id: number;
  from_id?: number;
  date: number;
  text: string;
  attachments?: VkAttachment[];
};
type VkWallResponse = {
  response?: { count: number; items?: VkWallItem[] };
  error?: { error_code: number; error_msg: string };
};

function extractPhotoUrl(photo: VkPhoto): string | undefined {
  const sizes = photo?.sizes;
  if (!Array.isArray(sizes) || sizes.length === 0) return undefined;
  const withUrl = sizes.filter((s) => s?.url);
  if (withUrl.length === 0) return undefined;
  const largest = withUrl.sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
  return largest.url;
}

function extractVideoPreview(video: VkVideo): string | undefined {
  const img = video?.image ?? video?.first_frame;
  if (Array.isArray(img) && img.length > 0) {
    const withUrl = img.filter((s) => s?.url);
    return withUrl[0]?.url;
  }
  return undefined;
}

function mapAttachment(att: VkAttachment): { type: string; url?: string; title?: string } {
  const type = att.type ?? 'unknown';
  let url: string | undefined;
  let title: string | undefined;
  if (att.photo) url = extractPhotoUrl(att.photo);
  if (att.video) url = extractVideoPreview(att.video) ?? url;
  if (att.link) {
    url = att.link.url ?? url;
    title = att.link.title;
  }
  return { type, url, title };
}

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);
  private readonly cacheKeyPrefix = 'news:list';

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {}

  private getTokenOrThrow(): string {
    const token = this.configService.get<string>('VK_ACCESS_TOKEN');
    if (typeof token !== 'string' || !token.trim()) {
      throw new BadRequestException(
        'VK_ACCESS_TOKEN is not set. Configure VK API in .env.',
      );
    }
    return token.trim();
  }

  private getGroupIdOrThrow(): number {
    const raw = this.configService.get<string>('VK_GROUP_ID');
    if (typeof raw !== 'string' || !raw.trim()) {
      throw new BadRequestException(
        'VK_GROUP_ID is not set. Configure VK API in .env.',
      );
    }
    const n = parseInt(raw.trim(), 10);
    if (!Number.isFinite(n) || n <= 0) {
      throw new BadRequestException('VK_GROUP_ID must be a positive number.');
    }
    return n;
  }

  private clampLimit(limit?: number): number {
    if (typeof limit !== 'number' || !Number.isFinite(limit)) return 10;
    const n = Math.trunc(limit);
    return Math.min(100, Math.max(1, n));
  }

  private clampOffset(offset?: number): number {
    if (typeof offset !== 'number' || !Number.isFinite(offset)) return 0;
    const n = Math.trunc(offset);
    return Math.max(0, n);
  }

  async getNews(filter?: NewsFilterInput): Promise<NewsItemEntity[]> {
    const limit = this.clampLimit(filter?.limit);
    const offset = this.clampOffset(filter?.offset);
    const cacheKey = `${this.cacheKeyPrefix}:${limit}:${offset}`;

    const cached = await this.cacheService.get<NewsItemEntity[]>(cacheKey);
    if (cached != null) {
      return cached;
    }

    const token = this.getTokenOrThrow();
    const groupId = this.getGroupIdOrThrow();
    const ownerId = -groupId;
    const version = this.configService.get<string>('VK_API_VERSION') ?? '5.199';

    const params = new URLSearchParams({
      owner_id: String(ownerId),
      count: String(limit),
      offset: String(offset),
      filter: 'owner',
      v: version,
      access_token: token,
    });

    const url = `${VK_API_BASE}/wall.get?${params.toString()}`;
    let res: Response;
    try {
      res = await fetch(url);
    } catch (err) {
      this.logger.error('VK API request failed', err);
      throw new BadRequestException('Failed to fetch news from VK.');
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`VK API HTTP ${res.status}: ${text.slice(0, 200)}`);
      throw new BadRequestException('VK API request failed.');
    }

    const json = (await res.json()) as VkWallResponse;
    if (json.error) {
      this.logger.warn(`VK API error: ${json.error.error_msg}`);
      throw new BadRequestException(
        `VK API: ${json.error.error_msg} (code ${json.error.error_code})`,
      );
    }

    const items = json.response?.items ?? [];
    const entities: NewsItemEntity[] = items.map((item) => {
      const attachments = (item.attachments ?? []).map(mapAttachment);
      const vkUrl = `https://vk.com/wall${item.owner_id}_${item.id}`;
      return {
        id: `${item.owner_id}_${item.id}`,
        text: item.text ?? '',
        date: new Date(item.date * 1000).toISOString(),
        attachments: attachments.length > 0 ? attachments : undefined,
        vkUrl,
      };
    });

    await this.cacheService.set(cacheKey, entities, NEWS_CACHE_TTL);
    return entities;
  }
}
