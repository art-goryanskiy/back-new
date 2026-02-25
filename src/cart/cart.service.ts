import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cart, CartItem, type CartDocument } from './cart.schema';
import { MAX_CART_ITEMS, MAX_QUANTITY_PER_ITEM } from './cart.schema';
import type { ProgramDocument } from 'src/programs/program.schema';
import { ProgramsService } from 'src/programs/programs.service';
import { CategoryService } from 'src/category/category.service';
import { buildProgramDisplayTitle } from 'src/common/utils/program-display-title';
import type { AddToCartInput, UpdateCartItemInput } from './cart.input';

export type EnrichedCartItem = {
  programId: string;
  pricingIndex: number;
  subProgramIndex?: number;
  subProgramTitle?: string;
  /** Дополненное наименование для отображения (по типу категории). */
  displayTitle: string;
  quantity: number;
  program: ProgramDocument;
  lineAmount: number;
};

function sameSubProgramIndex(
  a: number | undefined | null,
  b: number | undefined | null,
): boolean {
  const va = a ?? undefined;
  const vb = b ?? undefined;
  return va === vb;
}

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name)
    private readonly cartModel: Model<CartDocument>,
    private readonly programsService: ProgramsService,
    private readonly categoryService: CategoryService,
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
    if (
      !Array.isArray(pricing) ||
      pricingIndex < 0 ||
      pricingIndex >= pricing.length
    ) {
      throw new BadRequestException('Invalid pricing index for program');
    }
    const tier = pricing[pricingIndex];
    if (!tier || typeof tier.price !== 'number') {
      throw new BadRequestException('Invalid pricing for program');
    }
  }

  private validateSubProgramIndex(
    program: ProgramDocument,
    subProgramIndex: number,
  ) {
    const subPrograms = program.subPrograms;
    if (
      !Array.isArray(subPrograms) ||
      subProgramIndex < 0 ||
      subProgramIndex >= subPrograms.length
    ) {
      throw new BadRequestException('Invalid subProgram index for program');
    }
  }

  async addItem(userId: string, input: AddToCartInput): Promise<CartDocument> {
    const program = await this.programsService.findOne(input.programId);
    this.validatePricingIndex(program, input.pricingIndex);
    const subProgramIndex =
      input.subProgramIndex !== undefined && input.subProgramIndex !== null
        ? input.subProgramIndex
        : undefined;
    if (subProgramIndex !== undefined) {
      this.validateSubProgramIndex(program, subProgramIndex);
    }

    const quantity = Math.min(
      Math.max(1, Math.floor(input.quantity)),
      MAX_QUANTITY_PER_ITEM,
    );

    const cart = await this.getOrCreateCart(userId);

    const programOid = new Types.ObjectId(input.programId);
    const existingIdx = cart.items.findIndex(
      (i) =>
        i.program.equals(programOid) &&
        i.pricingIndex === input.pricingIndex &&
        sameSubProgramIndex(i.subProgramIndex, subProgramIndex),
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
      const newItem: CartItem = {
        program: programOid,
        pricingIndex: input.pricingIndex,
        quantity,
      };
      if (subProgramIndex !== undefined) {
        newItem.subProgramIndex = subProgramIndex;
      }
      cart.items.push(newItem);
    }

    return cart.save();
  }

  async updateItem(
    userId: string,
    input: UpdateCartItemInput,
  ): Promise<CartDocument> {
    const program = await this.programsService.findOne(input.programId);
    this.validatePricingIndex(program, input.pricingIndex);
    const subProgramIndex =
      input.subProgramIndex !== undefined && input.subProgramIndex !== null
        ? input.subProgramIndex
        : undefined;
    if (subProgramIndex !== undefined) {
      this.validateSubProgramIndex(program, subProgramIndex);
    }

    const quantity = Math.min(
      Math.max(1, Math.floor(input.quantity)),
      MAX_QUANTITY_PER_ITEM,
    );

    const cart = await this.getOrCreateCart(userId);
    const programOid = new Types.ObjectId(input.programId);
    const item = cart.items.find(
      (i) =>
        i.program.equals(programOid) &&
        i.pricingIndex === input.pricingIndex &&
        sameSubProgramIndex(i.subProgramIndex, subProgramIndex),
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
    subProgramIndex?: number,
  ): Promise<CartDocument> {
    const cart = await this.getOrCreateCart(userId);
    const programOid = new Types.ObjectId(programId);
    const wantSub = subProgramIndex ?? undefined;
    const before = cart.items.length;
    cart.items = cart.items.filter(
      (i) =>
        !i.program.equals(programOid) ||
        i.pricingIndex !== pricingIndex ||
        !sameSubProgramIndex(i.subProgramIndex, wantSub),
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
    const itemsToRemove: {
      programOid: Types.ObjectId;
      pricingIndex: number;
      subProgramIndex?: number;
    }[] = [];
    const enriched: EnrichedCartItem[] = [];
    let totalAmount = 0;

    for (const item of cart.items) {
      let program: ProgramDocument;
      try {
        program = await this.programsService.findOne(item.program.toString());
      } catch {
        itemsToRemove.push({
          programOid: item.program,
          pricingIndex: item.pricingIndex,
          subProgramIndex: item.subProgramIndex,
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
          programOid: item.program,
          pricingIndex: item.pricingIndex,
          subProgramIndex: item.subProgramIndex,
        });
        continue;
      }

      const subProgramIndex = item.subProgramIndex ?? undefined;
      let subProgramTitle: string | undefined;
      if (subProgramIndex !== undefined) {
        const subPrograms = program.subPrograms;
        if (
          !Array.isArray(subPrograms) ||
          subProgramIndex < 0 ||
          subProgramIndex >= subPrograms.length
        ) {
          itemsToRemove.push({
            programOid: item.program,
            pricingIndex: item.pricingIndex,
            subProgramIndex: item.subProgramIndex,
          });
          continue;
        }
        subProgramTitle = subPrograms[subProgramIndex]?.title;
      }

      const tier = pricing[item.pricingIndex];
      const price = typeof tier?.price === 'number' ? tier.price : 0;
      const lineAmount = price * item.quantity;
      let categoryType: string | undefined;
      try {
        const category = await this.categoryService.findOne(
          program.category.toString(),
        );
        categoryType = category?.type;
      } catch {
        categoryType = undefined;
      }
      const displayTitle = buildProgramDisplayTitle(
        categoryType,
        subProgramTitle ?? program.title,
      );
      totalAmount += lineAmount;
      enriched.push({
        programId: item.program.toString(),
        pricingIndex: item.pricingIndex,
        subProgramIndex,
        subProgramTitle,
        displayTitle,
        quantity: item.quantity,
        program,
        lineAmount,
      });
    }

    if (itemsToRemove.length > 0) {
      for (const {
        programOid,
        pricingIndex,
        subProgramIndex,
      } of itemsToRemove) {
        const wantSub = subProgramIndex ?? undefined;
        cart.items = cart.items.filter(
          (i) =>
            !i.program.equals(programOid) ||
            i.pricingIndex !== pricingIndex ||
            !sameSubProgramIndex(i.subProgramIndex, wantSub),
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
