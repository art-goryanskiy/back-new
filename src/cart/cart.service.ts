import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cart, CartItem, type CartDocument } from './cart.schema';
import {
  MAX_CART_ITEMS,
  MAX_QUANTITY_PER_ITEM,
} from './cart.schema';
import type { ProgramDocument } from 'src/programs/program.schema';
import { ProgramsService } from 'src/programs/programs.service';
import type {
  AddToCartInput,
  UpdateCartItemInput,
} from './cart.input';

export type EnrichedCartItem = {
  programId: string;
  pricingIndex: number;
  quantity: number;
  program: ProgramDocument;
  lineAmount: number;
};

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name)
    private readonly cartModel: Model<CartDocument>,
    private readonly programsService: ProgramsService,
  ) {}

  private async getOrCreateCart(userId: string): Promise<CartDocument> {
    const userOid = new Types.ObjectId(userId);
    let cart = await this.cartModel.findOne({ user: userOid });
    if (!cart) {
      cart = await this.cartModel.create({ user: userOid, items: [] });
    }
    return cart;
  }

  private validatePricingIndex(program: ProgramDocument, pricingIndex: number) {
    const pricing = program.pricing;
    if (!Array.isArray(pricing) || pricingIndex < 0 || pricingIndex >= pricing.length) {
      throw new BadRequestException('Invalid pricing index for program');
    }
    const tier = pricing[pricingIndex];
    if (!tier || typeof tier.price !== 'number') {
      throw new BadRequestException('Invalid pricing for program');
    }
  }

  async addItem(userId: string, input: AddToCartInput): Promise<CartDocument> {
    const program = await this.programsService.findOne(input.programId);
    this.validatePricingIndex(program, input.pricingIndex);

    const quantity = Math.min(
      Math.max(1, Math.floor(input.quantity)),
      MAX_QUANTITY_PER_ITEM,
    );

    const cart = await this.getOrCreateCart(userId);

    const programOid = new Types.ObjectId(input.programId);
    const existingIdx = cart.items.findIndex(
      (i) =>
        i.program.equals(programOid) && i.pricingIndex === input.pricingIndex,
    );

    if (existingIdx >= 0) {
      const newQty = Math.min(
        cart.items[existingIdx].quantity + quantity,
        MAX_QUANTITY_PER_ITEM,
      );
      cart.items[existingIdx].quantity = newQty;
    } else {
      if (cart.items.length >= MAX_CART_ITEMS) {
        throw new BadRequestException(
          `Cart cannot have more than ${MAX_CART_ITEMS} items`,
        );
      }
      cart.items.push({
        program: programOid,
        pricingIndex: input.pricingIndex,
        quantity,
      });
    }

    return cart.save();
  }

  async updateItem(
    userId: string,
    input: UpdateCartItemInput,
  ): Promise<CartDocument> {
    const program = await this.programsService.findOne(input.programId);
    this.validatePricingIndex(program, input.pricingIndex);

    const quantity = Math.min(
      Math.max(1, Math.floor(input.quantity)),
      MAX_QUANTITY_PER_ITEM,
    );

    const cart = await this.getOrCreateCart(userId);
    const programOid = new Types.ObjectId(input.programId);
    const item = cart.items.find(
      (i) =>
        i.program.equals(programOid) && i.pricingIndex === input.pricingIndex,
    );
    if (!item) {
      throw new NotFoundException('Cart item not found');
    }
    item.quantity = quantity;
    return cart.save();
  }

  async removeItem(
    userId: string,
    programId: string,
    pricingIndex: number,
  ): Promise<CartDocument> {
    const cart = await this.getOrCreateCart(userId);
    const programOid = new Types.ObjectId(programId);
    const before = cart.items.length;
    cart.items = cart.items.filter(
      (i) =>
        !i.program.equals(programOid) || i.pricingIndex !== pricingIndex,
    );
    if (cart.items.length === before) {
      throw new NotFoundException('Cart item not found');
    }
    return cart.save();
  }

  async getCartWithEnrichedItems(
    userId: string,
  ): Promise<{ items: EnrichedCartItem[]; totalAmount: number }> {
    const cart = await this.getOrCreateCart(userId);
    const itemsToRemove: { programOid: Types.ObjectId; pricingIndex: number }[] = [];
    const enriched: EnrichedCartItem[] = [];
    let totalAmount = 0;

    for (const item of cart.items) {
      let program: ProgramDocument;
      try {
        program = await this.programsService.findOne(item.program.toString());
      } catch {
        itemsToRemove.push({
          programOid: item.program as Types.ObjectId,
          pricingIndex: item.pricingIndex,
        });
        continue;
      }

      const pricing = program.pricing;
      if (
        !Array.isArray(pricing) ||
        item.pricingIndex < 0 ||
        item.pricingIndex >= pricing.length
      ) {
        itemsToRemove.push({
          programOid: item.program as Types.ObjectId,
          pricingIndex: item.pricingIndex,
        });
        continue;
      }

      const tier = pricing[item.pricingIndex];
      const price = typeof tier?.price === 'number' ? tier.price : 0;
      const lineAmount = price * item.quantity;
      totalAmount += lineAmount;
      enriched.push({
        programId: item.program.toString(),
        pricingIndex: item.pricingIndex,
        quantity: item.quantity,
        program,
        lineAmount,
      });
    }

    if (itemsToRemove.length > 0) {
      for (const { programOid, pricingIndex } of itemsToRemove) {
        cart.items = cart.items.filter(
          (i) =>
            !i.program.equals(programOid) || i.pricingIndex !== pricingIndex,
        );
      }
      await cart.save();
    }

    return { items: enriched, totalAmount };
  }

  async clearCart(userId: string): Promise<void> {
    const cart = await this.getOrCreateCart(userId);
    cart.items = [];
    await cart.save();
  }
}
