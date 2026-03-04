import { Injectable, Inject, forwardRef, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AdminNotification,
  AdminNotificationDocument,
} from './admin-notification.schema';
import {
  AdminNotificationEntityType,
  AdminNotificationType,
} from './admin-notification.enums';
import { ChatGateway } from '../chat/chat.gateway';

export interface CreateAdminNotificationInput {
  type: AdminNotificationType;
  entityType: AdminNotificationEntityType;
  entityId: string;
  title: string;
  message: string;
}

@Injectable()
export class AdminNotificationService {
  constructor(
    @InjectModel(AdminNotification.name)
    private readonly adminNotificationModel: Model<AdminNotificationDocument>,
    @Optional()
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway | null,
  ) {}

  async createNotification(
    input: CreateAdminNotificationInput,
  ): Promise<AdminNotificationDocument> {
    const doc = await this.adminNotificationModel.create({
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId,
      title: input.title,
      message: input.message,
    });
    this.chatGateway?.emitAdminNotification({
      id: (doc._id as Types.ObjectId).toString(),
      type: doc.type,
      entityType: doc.entityType,
      entityId: doc.entityId,
      title: doc.title,
      message: doc.message,
      createdAt: (doc.createdAt ?? new Date()).toISOString(),
    });
    return doc;
  }

  async findManyForAdmin(
    adminId: string,
    opts?: { limit?: number; offset?: number; unreadOnly?: boolean },
  ): Promise<AdminNotificationDocument[]> {
    const limit = Math.min(Math.max(opts?.limit ?? 30, 1), 100);
    const offset = Math.max(opts?.offset ?? 0, 0);
    const adminObjectId = new Types.ObjectId(adminId);
    const filter: Record<string, unknown> = {};
    if (opts?.unreadOnly) {
      filter.readBy = { $ne: adminObjectId };
    }
    return (await this.adminNotificationModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec()) as unknown as AdminNotificationDocument[];
  }

  async getUnreadCountForAdmin(adminId: string): Promise<number> {
    return this.adminNotificationModel
      .countDocuments({ readBy: { $ne: new Types.ObjectId(adminId) } })
      .exec();
  }

  async markReadForAdmin(
    notificationId: string,
    adminId: string,
  ): Promise<boolean> {
    const result = await this.adminNotificationModel
      .updateOne(
        { _id: new Types.ObjectId(notificationId) },
        { $addToSet: { readBy: new Types.ObjectId(adminId) } },
      )
      .exec();
    return (result.matchedCount ?? 0) > 0;
  }

  async markAllReadForAdmin(adminId: string): Promise<number> {
    const adminObjectId = new Types.ObjectId(adminId);
    const result = await this.adminNotificationModel
      .updateMany(
        { readBy: { $ne: adminObjectId } },
        { $addToSet: { readBy: adminObjectId } },
      )
      .exec();
    return result.modifiedCount ?? 0;
  }
}
