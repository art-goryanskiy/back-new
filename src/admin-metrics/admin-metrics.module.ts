import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from '../order/order.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import {
  Chat,
  ChatSchema,
  Message,
  MessageSchema,
} from '../chat/chat.schema';
import { Cart, CartSchema } from '../cart/cart.schema';
import { AdminMetricsService } from './admin-metrics.service';
import { AdminMetricsResolver } from './admin-metrics.resolver';
import { AdminGuard } from '../common/guards/admin.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: User.name, schema: UserSchema },
      { name: Chat.name, schema: ChatSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Cart.name, schema: CartSchema },
    ]),
  ],
  providers: [AdminMetricsService, AdminMetricsResolver, AdminGuard],
})
export class AdminMetricsModule {}
