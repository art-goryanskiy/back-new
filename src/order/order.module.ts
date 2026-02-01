import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from './order.schema';
import { OrderService } from './order.service';
import { OrderResolver } from './order.resolver';
import { UserModule } from '../user/user.module';
import { CartModule } from '../cart/cart.module';
import { PaymentModule } from '../payment/payment.module';
import { OrganizationModule } from '../organization/organization.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    forwardRef(() => UserModule),
    forwardRef(() => CartModule),
    PaymentModule,
    OrganizationModule,
  ],
  providers: [OrderService, OrderResolver],
  exports: [OrderService],
})
export class OrderModule {}
