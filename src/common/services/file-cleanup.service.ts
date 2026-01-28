import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from 'src/storage/storage.service';

@Injectable()
export class FileCleanupService {
  private readonly logger = new Logger(FileCleanupService.name);

  constructor(private readonly storageService: StorageService) {}

  /**
   * Безопасно удаляет файл по URL с обработкой ошибок
   */
  async safeDeleteFile(
    url: string | undefined,
    context: string,
  ): Promise<void> {
    if (!url) return;

    try {
      await this.storageService.deleteFileByUrl(url);
    } catch (error: unknown) {
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error deleting ${context} file: ${url}`, stack);
    }
  }
}
