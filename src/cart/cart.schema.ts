import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from 'src/user/schemas/user.schema';

@Schema({ _id: false })
export class CartItem {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Program' })
  program: Types.ObjectId;

  @Prop({ required: true, type: Number, min: 0 })
  pricingIndex: number;

  @Prop({ required: true, type: Number, min: 1 })
  quantity: number;
}

export const MAX_CART_ITEMS = 20;
export const MAX_QUANTITY_PER_ITEM = 100;

@Schema({
  timestamps: true,
})
export class Cart {
  @Prop({ required: true, type: Types.ObjectId, ref: User.name, unique: true })
  user: Types.ObjectId;

  @Prop({ type: [CartItem], default: [] })
  items: CartItem[];
}

export type CartDocument = HydratedDocument<Cart>;
export const CartSchema = SchemaFactory.createForClass(Cart);

// Индекс по user не добавляем: unique: true на поле user уже создаёт индекс { user: 1 }
