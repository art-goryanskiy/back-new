import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';

interface ImageProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  fit?: 'inside' | 'cover';
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor(private configService: ConfigService) {
    this.bucket = this.configService.get<string>('YANDEX_STORAGE_BUCKET') || '';

    this.s3Client = new S3Client({
      endpoint:
        this.configService.get<string>('YANDEX_STORAGE_ENDPOINT') ||
        'https://storage.yandexcloud.net',
      region:
        this.configService.get<string>('YANDEX_STORAGE_REGION') ||
        'ru-central1',
      credentials: {
        accessKeyId:
          this.configService.get<string>('YANDEX_STORAGE_ACCESS_KEY') || '',
        secretAccessKey:
          this.configService.get<string>('YANDEX_STORAGE_SECRET_KEY') || '',
      },
    });
  }

  async processImage(
    buffer: Buffer,
    options: ImageProcessingOptions = {},
  ): Promise<Buffer> {
    const {
      maxWidth = 1920,
      maxHeight = 1080,
      quality = 85,
      format = 'webp',
      fit = 'inside',
    } = options;

    let pipeline = sharp(buffer);

    const metadata = await pipeline.metadata();

    if (fit === 'cover') {
      pipeline = pipeline.resize(maxWidth, maxHeight, { fit: 'cover' });
    } else {
      // старое поведение для остальных: уменьшаем только если больше лимитов
      if (metadata.width && metadata.height) {
        if (metadata.width > maxWidth || metadata.height > maxHeight) {
          pipeline = pipeline.resize(maxWidth, maxHeight, {
            fit: 'inside',
            withoutEnlargement: true,
          });
        }
      }
    }

    switch (format) {
      case 'webp':
        pipeline = pipeline.webp({ quality });
        break;
      case 'jpeg':
        pipeline = pipeline.jpeg({ quality, mozjpeg: true });
        break;
      case 'png':
        pipeline = pipeline.png({ quality, compressionLevel: 9 });
        break;
    }

    return pipeline.toBuffer();
  }

  async uploadFile(
    file: Buffer,
    key: string,
    contentType?: string,
    processImage = true,
    options: ImageProcessingOptions = {},
  ): Promise<string> {
    try {
      let fileBuffer = file;
      let finalContentType = contentType || 'image/jpeg';
      let finalKey = key;

      const isSvg = contentType === 'image/svg+xml';

      if (processImage && contentType?.startsWith('image/') && !isSvg) {
        try {
          fileBuffer = await this.processImage(file, {
            maxWidth: 1920,
            maxHeight: 1080,
            quality: 85,
            format: 'webp',
            fit: 'inside',
            ...options,
          });
          finalContentType = 'image/webp';

          finalKey = /\.[^.]+$/.test(key)
            ? key.replace(/\.[^.]+$/, '.webp')
            : `${key}.webp`;
        } catch (error) {
          this.logger.warn('Image processing failed, saving original:', error);
          finalKey = /\.[^.]+$/.test(key) ? key : `${key}.webp`;
        }
      }

      if (isSvg) {
        finalKey = /\.[^.]+$/.test(key)
          ? key.replace(/\.[^.]+$/, '.svg')
          : `${key}.svg`;
        finalContentType = 'image/svg+xml';
      }
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: finalKey,
        Body: fileBuffer,
        ContentType: finalContentType,
      });

      await this.s3Client.send(command);

      const url = `https://${this.bucket}.storage.yandexcloud.net/${finalKey}`;
      this.logger.log(`File uploaded: ${url}`);
      return url;
    } catch (error) {
      this.logger.error('Error uploading file:', error);
      throw error;
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`File deleted: ${key}`);
    } catch (error) {
      this.logger.error('Error deleting file:', error);
      throw error;
    }
  }

  generateKey(
    folder: 'categories' | 'programs' | 'avatars',
    filename?: string,
  ): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);

    if (filename && filename.toLowerCase().endsWith('.svg')) {
      return `${folder}/${timestamp}-${random}.svg`;
    }

    return `${folder}/${timestamp}-${random}`;
  }

  extractKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      return pathname.startsWith('/') ? pathname.substring(1) : pathname;
    } catch (error) {
      this.logger.error('Error extracting key from URL:', error);
      return null;
    }
  }

  async deleteFileByUrl(url: string): Promise<void> {
    const key = this.extractKeyFromUrl(url);
    if (key) {
      await this.deleteFile(key);
    } else {
      this.logger.warn(`Could not extract key from URL: ${url}`);
    }
  }
}
