import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from 'src/common/decorators/current-user.decorator';
import { OrderEntity } from './order.entity';
import { OrderService } from './order.service';
import {
  CreateOrderFromCartInput,
  MyOrdersFilterInput,
} from './order.input';
import { toOrderEntity, toOrderEntityArray } from 'src/common/mappers/order.mapper';

@Resolver(() => OrderEntity)
export class OrderResolver {
  constructor(private readonly orderService: OrderService) {}

  @UseGuards(JwtAuthGuard)
  @Mutation(() => OrderEntity)
  async createOrderFromCart(
    @Args('input') input: CreateOrderFromCartInput,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<OrderEntity> {
    const order = await this.orderService.createOrderFromCart(user.id, input);
    return toOrderEntity(order)!;
  }

  @UseGuards(JwtAuthGuard)
  @Query(() => [OrderEntity])
  async myOrders(
    @Args('filter', { nullable: true }) filter: MyOrdersFilterInput | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<OrderEntity[]> {
    const orders = await this.orderService.findMyOrders(user.id, {
      status: filter?.status,
      limit: filter?.limit,
      offset: filter?.offset,
    });
    return toOrderEntityArray(orders);
  }

  @UseGuards(JwtAuthGuard)
  @Query(() => OrderEntity)
  async order(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<OrderEntity> {
    const order = await this.orderService.findByIdAndUser(id, user.id);
    return toOrderEntity(order)!;
  }
}
