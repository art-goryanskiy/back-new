import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from 'src/user/user.module';
import { ProgramsModule } from 'src/programs/programs.module';
import { CategoryModule } from 'src/category/category.module';
import { Cart, CartSchema } from './cart.schema';
import { CartService } from './cart.service';
import { CartResolver } from './cart.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Cart.name, schema: CartSchema }]),
    forwardRef(() => UserModule),
    forwardRef(() => ProgramsModule),
    CategoryModule,
  ],
  providers: [CartService, CartResolver],
  exports: [CartService],
})
export class CartModule {}
