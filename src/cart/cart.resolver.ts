import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from 'src/common/decorators/current-user.decorator';
import { CartEntity, CartItemEntity } from './cart.entity';
import { CartService } from './cart.service';
import {
  AddToCartInput,
  UpdateCartItemInput,
  RemoveFromCartInput,
} from './cart.input';
import { toProgramEntity } from 'src/common/mappers/program.mapper';

@Resolver(() => CartEntity)
export class CartResolver {
  constructor(private readonly cartService: CartService) {}

  @UseGuards(JwtAuthGuard)
  @Query(() => CartEntity)
  async myCart(@CurrentUser() user: CurrentUserPayload): Promise<CartEntity> {
    const { items, totalAmount } = await this.cartService.getCartWithEnrichedItems(
      user.id,
    );
    const cartItems: CartItemEntity[] = items.map((item) => ({
      programId: item.programId,
      pricingIndex: item.pricingIndex,
      quantity: item.quantity,
      program: toProgramEntity(item.program)!,
      lineAmount: item.lineAmount,
    }));
    return {
      items: cartItems,
      totalAmount,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => CartEntity)
  async addToCart(
    @Args('input') input: AddToCartInput,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<CartEntity> {
    await this.cartService.addItem(user.id, input);
    const { items, totalAmount } = await this.cartService.getCartWithEnrichedItems(
      user.id,
    );
    const cartItems: CartItemEntity[] = items.map((item) => ({
      programId: item.programId,
      pricingIndex: item.pricingIndex,
      quantity: item.quantity,
      program: toProgramEntity(item.program)!,
      lineAmount: item.lineAmount,
    }));
    return { items: cartItems, totalAmount };
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => CartEntity)
  async updateCartItem(
    @Args('input') input: UpdateCartItemInput,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<CartEntity> {
    await this.cartService.updateItem(user.id, input);
    const { items, totalAmount } = await this.cartService.getCartWithEnrichedItems(
      user.id,
    );
    const cartItems: CartItemEntity[] = items.map((item) => ({
      programId: item.programId,
      pricingIndex: item.pricingIndex,
      quantity: item.quantity,
      program: toProgramEntity(item.program)!,
      lineAmount: item.lineAmount,
    }));
    return { items: cartItems, totalAmount };
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => CartEntity)
  async removeFromCart(
    @Args('input') input: RemoveFromCartInput,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<CartEntity> {
    await this.cartService.removeItem(user.id, input.programId, input.pricingIndex);
    const { items, totalAmount } = await this.cartService.getCartWithEnrichedItems(
      user.id,
    );
    const cartItems: CartItemEntity[] = items.map((item) => ({
      programId: item.programId,
      pricingIndex: item.pricingIndex,
      quantity: item.quantity,
      program: toProgramEntity(item.program)!,
      lineAmount: item.lineAmount,
    }));
    return { items: cartItems, totalAmount };
  }
}
