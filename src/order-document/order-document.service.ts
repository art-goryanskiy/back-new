import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  OrderDocumentModel,
  OrderDocumentKind,
  type OrderDocumentDocument,
} from './order-document.schema';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class OrderDocumentService {
  private readonly logger = new Logger(OrderDocumentService.name);

  constructor(
    @InjectModel(OrderDocumentModel.name)
    private readonly orderDocumentModel: Model<OrderDocumentDocument>,
    private readonly storageService: StorageService,
  ) {}

  async create(
    orderId: string,
    kind: OrderDocumentKind,
    fileUrl: string,
    documentDate: Date,
  ): Promise<OrderDocumentDocument> {
    const doc = await this.orderDocumentModel.create({
      order: new Types.ObjectId(orderId),
      kind,
      fileUrl,
      documentDate,
    });
    return doc;
  }

  async findByOrder(orderId: string): Promise<OrderDocumentDocument[]> {
    return this.orderDocumentModel
      .find({ order: new Types.ObjectId(orderId) })
      .sort({ documentDate: -1, createdAt: -1 })
      .exec();
  }

  async findById(id: string): Promise<OrderDocumentDocument> {
    const doc = await this.orderDocumentModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Order document not found');
    return doc;
  }

  async updateDocumentDate(
    id: string,
    documentDate: Date,
  ): Promise<OrderDocumentDocument> {
    const doc = await this.findById(id);
    doc.documentDate = documentDate;
    await doc.save();
    return doc;
  }

  /**
   * Найти документы заказа по виду (например, одна заявка на обучение на заказ).
   */
  async findByOrderAndKind(
    orderId: string,
    kind: OrderDocumentKind,
  ): Promise<OrderDocumentDocument[]> {
    return this.orderDocumentModel
      .find({ order: new Types.ObjectId(orderId), kind })
      .exec();
  }

  /**
   * Удалить все документы заказа указанного вида: файлы из хранилища и записи в БД.
   * Используется перед повторной генерацией заявки на обучение, чтобы в заказе была только одна такая заявка.
   */
  async deleteByOrderAndKind(
    orderId: string,
    kind: OrderDocumentKind,
  ): Promise<void> {
    const docs = await this.findByOrderAndKind(orderId, kind);
    for (const doc of docs) {
      try {
        await this.storageService.deleteFileByUrl(doc.fileUrl);
      } catch (e) {
        this.logger.warn(
          `deleteByOrderAndKind: failed to delete file ${doc.fileUrl}`,
          e,
        );
      }
    }
    await this.orderDocumentModel
      .deleteMany({ order: new Types.ObjectId(orderId), kind })
      .exec();
  }
}
