import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  OrderDocumentModel,
  OrderDocumentKind,
  type OrderDocumentDocument,
} from './order-document.schema';

@Injectable()
export class OrderDocumentService {
  constructor(
    @InjectModel(OrderDocumentModel.name)
    private readonly orderDocumentModel: Model<OrderDocumentDocument>,
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
}
