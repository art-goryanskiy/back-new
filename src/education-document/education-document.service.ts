import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  EducationDocument,
  type EducationDocumentDocument,
} from './education-document.schema';
import {
  CreateEducationDocumentInput,
  UpdateEducationDocumentInput,
} from './education-document.input';
import { FileCleanupService } from 'src/common/services/file-cleanup.service';

@Injectable()
export class EducationDocumentService {
  constructor(
    @InjectModel(EducationDocument.name)
    private readonly educationDocumentModel: Model<EducationDocumentDocument>,
    private readonly fileCleanupService: FileCleanupService,
  ) {}

  async create(
    input: CreateEducationDocumentInput,
  ): Promise<EducationDocumentDocument> {
    const doc = await this.educationDocumentModel.create({
      name: input.name.trim(),
      image: input.image ?? undefined,
    });
    return doc;
  }

  async findAll(): Promise<EducationDocumentDocument[]> {
    return this.educationDocumentModel.find().sort({ name: 1 }).exec();
  }

  async findOne(id: string): Promise<EducationDocumentDocument> {
    const doc = await this.educationDocumentModel.findById(id);
    if (!doc) throw new NotFoundException('Education document not found');
    return doc;
  }

  async findById(
    id: string,
  ): Promise<EducationDocumentDocument | null> {
    return this.educationDocumentModel.findById(id);
  }

  async update(
    id: string,
    input: UpdateEducationDocumentInput,
  ): Promise<EducationDocumentDocument> {
    const doc = await this.educationDocumentModel.findById(id);
    if (!doc) throw new NotFoundException('Education document not found');

    const oldImageUrl = doc.image;

    if (input.name !== undefined) {
      doc.name = input.name.trim();
    }

    if (input.image !== undefined) {
      if (oldImageUrl && oldImageUrl !== input.image) {
        await this.fileCleanupService.safeDeleteFile(
          oldImageUrl,
          'education document old image',
        );
      }
      doc.image = input.image ?? undefined;
    }

    return doc.save();
  }

  async remove(id: string): Promise<EducationDocumentDocument> {
    const doc = await this.educationDocumentModel.findById(id);
    if (!doc) throw new NotFoundException('Education document not found');

    if (doc.image) {
      await this.fileCleanupService.safeDeleteFile(
        doc.image,
        'education document image',
      );
    }

    await this.educationDocumentModel.findByIdAndDelete(id);
    return doc;
  }
}
