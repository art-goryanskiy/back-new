import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from './order.schema';
import { OrderService } from './order.service';
import { OrderResolver } from './order.resolver';
import { OrderAdminResolver } from './order-admin.resolver';
import { OrderController } from './order.controller';
import { TbankEacqNotificationController } from './tbank-eacq-notification.controller';
import { AdminGuard } from '../common/guards/admin.guard';
import { UserModule } from '../user/user.module';
import { OrderDocumentModule } from '../order-document/order-document.module';
import { CartModule } from '../cart/cart.module';
import { PaymentModule } from '../payment/payment.module';
import { OrganizationModule } from '../organization/organization.module';
import { CategoryModule } from '../category/category.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    forwardRef(() => UserModule),
    forwardRef(() => CartModule),
    forwardRef(() => OrderDocumentModule),
    PaymentModule,
    OrganizationModule,
    CategoryModule,
  ],
  controllers: [OrderController, TbankEacqNotificationController],
  providers: [OrderService, OrderResolver, OrderAdminResolver, AdminGuard],
  exports: [OrderService],
})
export class OrderModule {}
