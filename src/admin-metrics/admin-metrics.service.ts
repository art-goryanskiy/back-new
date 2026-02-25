import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, type OrderDocument } from '../order/order.schema';
import { OrderStatus } from '../order/order.enums';
import {
  User,
  UserRole,
  type UserDocument,
} from '../user/schemas/user.schema';
import { Chat, Message, type ChatDocument, type MessageDocument } from '../chat/chat.schema';
import { ChatStatus } from '../chat/chat.enums';
import { Cart, type CartDocument } from '../cart/cart.schema';
import type {
  AdminMetricsEntity,
  AdminOrderCountsEntity,
  AdminChatCountsEntity,
} from './admin-metrics.entity';

@Injectable()
export class AdminMetricsService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Cart.name) private cartModel: Model<CartDocument>,
  ) {}

  async getMetrics(): Promise<AdminMetricsEntity> {
    const [
      orderCounts,
      ordersTotal,
      revenueResult,
      usersTotal,
      usersNewLast30Days,
      chatOpen,
      chatClosed,
      chatOpenUnassigned,
      cartsWithItems,
    ] = await Promise.all([
      this.orderModel
        .aggregate<{ _id: OrderStatus; count: number }>([
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ])
        .exec(),
      this.orderModel.countDocuments().exec(),
      this.orderModel
        .aggregate<{ total: number }>([
          { $match: { status: OrderStatus.PAID } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ])
        .exec(),
      this.userModel.countDocuments({ role: UserRole.USER }).exec(),
      this.userModel
        .countDocuments({
          role: UserRole.USER,
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        })
        .exec(),
      this.chatModel.countDocuments({ status: ChatStatus.OPEN }).exec(),
      this.chatModel.countDocuments({ status: ChatStatus.CLOSED }).exec(),
      this.chatModel
        .countDocuments({
          status: ChatStatus.OPEN,
          $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }],
        })
        .exec(),
      this.cartModel
        .countDocuments({ 'items.0': { $exists: true } })
        .exec(),
    ]);

    const statusCount = (status: OrderStatus): number =>
      Number(
        orderCounts.find((r) => r._id === status)?.count ?? 0,
      );

    const orderCountsEntity: AdminOrderCountsEntity = {
      awaitingPayment: statusCount(OrderStatus.AWAITING_PAYMENT),
      paid: statusCount(OrderStatus.PAID),
      inProgress: statusCount(OrderStatus.IN_PROGRESS),
      completed: statusCount(OrderStatus.COMPLETED),
      cancelled: statusCount(OrderStatus.CANCELLED),
    };

    const chatCountsEntity: AdminChatCountsEntity = {
      open: chatOpen,
      closed: chatClosed,
      openUnassigned: chatOpenUnassigned,
    };

    const revenuePaid = Math.round(
      Number(revenueResult[0]?.total ?? 0),
    );

    return {
      orderCounts: orderCountsEntity,
      ordersTotal,
      revenuePaid,
      usersTotal,
      usersNewLast30Days,
      chatCounts: chatCountsEntity,
      cartsWithItems,
    };
  }
}
