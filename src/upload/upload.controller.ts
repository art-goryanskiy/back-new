import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { StorageService } from 'src/storage/storage.service';
import { memoryStorage } from 'multer';

@Controller('upload')
export class UploadController {
  constructor(private readonly storageService: StorageService) {}

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
      fileFilter: (req, file, callback) => {
        if (!file || !file.mimetype || !file.mimetype.startsWith('image/')) {
          return callback(
            new BadRequestException('File must be an image'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  @UseGuards(JwtAuthGuard)
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder')
    folder:
      | 'categories'
      | 'programs'
      | 'avatars'
      | 'education-documents',
  ): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const allowedFolders = [
      'categories',
      'programs',
      'avatars',
      'education-documents',
    ];
    if (!folder || !allowedFolders.includes(folder)) {
      throw new BadRequestException(
        `Folder must be one of: ${allowedFolders.join(', ')}`,
      );
    }

    const key = this.storageService.generateKey(folder, file.originalname);

    const url = await this.storageService.uploadFile(
      file.buffer,
      key,
      file.mimetype,
      true,
      folder === 'avatars'
        ? {
            maxWidth: 512,
            maxHeight: 512,
            quality: 85,
            format: 'webp',
            fit: 'cover',
          }
        : {
            maxWidth: 1920,
            maxHeight: 1080,
            quality: 85,
            format: 'webp',
            fit: 'inside',
          },
    );

    return { url };
  }
}
