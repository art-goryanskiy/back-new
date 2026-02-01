import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from 'src/common/decorators/current-user.decorator';
import {
  OrderEntity,
  CreateOrderSbpLinkResult,
  CreateOrderInvoiceResult,
  OrderInvoiceInfoResult,
  OrderSbpLinkInfoResult,
} from './order.entity';
import { OrderService } from './order.service';
import { CreateOrderFromCartInput, MyOrdersFilterInput } from './order.input';

/**
 * Инлайн-маппинг без импорта order.mapper и order.schema.
 * При сборке GraphQL-схемы Nest загружает резолвер; импорт order.mapper тянет
 * order.schema (Mongoose), что может вызывать зависание или конфликт при discovery.
 */
function mapToEntity(doc: {
  _id: unknown;
  user: { toString(): string };
  [k: string]: unknown;
}): OrderEntity {
  const id = String(
    (doc._id as { toString?: () => string })?.toString?.() ?? '',
  );
  const lines =
    (doc.lines as
      | Array<{
          program?: { toString(): string };
          programTitle?: string;
          hours?: number;
          price?: number;
          quantity?: number;
          lineAmount?: number;
          learners?: Array<{
            lastName: string;
            firstName: string;
            middleName?: string;
            email?: string;
            phone?: string;
          }>;
        }>
      | undefined) ?? [];
  return {
    id,
    userId: (doc.user as { toString: () => string }).toString(),
    customerType: doc.customerType as OrderEntity['customerType'],
    organizationId: (
      doc.organization as { toString?: () => string } | undefined
    )?.toString?.(),
    contactEmail: doc.contactEmail as string | undefined,
    contactPhone: doc.contactPhone as string | undefined,
    status: doc.status as OrderEntity['status'],
    totalAmount: Number(doc.totalAmount ?? 0),
    lines: lines.map((l) => ({
      programId: (l.program as { toString?: () => string })?.toString?.() ?? '',
      programTitle: l.programTitle ?? '',
      hours: l.hours ?? 0,
      price: l.price ?? 0,
      quantity: l.quantity ?? 0,
      lineAmount: l.lineAmount ?? 0,
      learners: (l.learners ?? []).map((ll) => ({
        lastName: ll.lastName,
        firstName: ll.firstName,
        middleName: ll.middleName,
        email: ll.email,
        phone: ll.phone,
      })),
    })),
    createdAt: (doc.createdAt as Date) ?? new Date(),
    updatedAt: (doc.updatedAt as Date) ?? new Date(),
  };
}

@Resolver(() => OrderEntity)
export class OrderResolver {
  constructor(private readonly orderService: OrderService) {}

  @UseGuards(JwtAuthGuard)
  @Query(() => [OrderEntity])
  async myOrders(
    @Args('filter', { type: () => MyOrdersFilterInput, nullable: true })
    filter: MyOrdersFilterInput | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<OrderEntity[]> {
    const orders = await this.orderService.findMyOrders(user.id, {
      status: filter?.status,
      limit: filter?.limit,
      offset: filter?.offset,
    });
    return orders.map((o) =>
      mapToEntity(o as unknown as Parameters<typeof mapToEntity>[0]),
    );
  }

  /** Получить информацию о ссылке СБП по заказу (T-Bank) */
  @UseGuards(JwtAuthGuard)
  @Query(() => OrderSbpLinkInfoResult)
  async orderSbpLinkStatus(
    @Args('orderId', { type: () => ID }) orderId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<OrderSbpLinkInfoResult> {
    return this.orderService.getOrderSbpLinkStatus(orderId, user.id);
  }

  /** Получить статус выставленного счёта по заказу (T-Bank) */
  @UseGuards(JwtAuthGuard)
  @Query(() => OrderInvoiceInfoResult)
  async orderInvoiceStatus(
    @Args('orderId', { type: () => ID }) orderId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<OrderInvoiceInfoResult> {
    return this.orderService.getOrderInvoiceStatus(orderId, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Query(() => OrderEntity)
  async order(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<OrderEntity> {
    const order = await this.orderService.findByIdAndUser(id, user.id);
    return mapToEntity(order as unknown as Parameters<typeof mapToEntity>[0]);
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => OrderEntity)
  async createOrderFromCart(
    @Args('input', { type: () => CreateOrderFromCartInput })
    input: CreateOrderFromCartInput,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<OrderEntity> {
    const order = await this.orderService.createOrderFromCart(user.id, input);
    return mapToEntity(order as unknown as Parameters<typeof mapToEntity>[0]);
  }

  /** Создать одноразовую ссылку СБП (T-Bank) для оплаты заказа */
  @UseGuards(JwtAuthGuard)
  @Mutation(() => CreateOrderSbpLinkResult)
  async createOrderSbpLink(
    @Args('orderId', { type: () => ID }) orderId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<CreateOrderSbpLinkResult> {
    return this.orderService.createSbpPaymentLink(orderId, user.id);
  }

  /** Выставить счёт (T-Bank) для оплаты заказа по счёту */
  @UseGuards(JwtAuthGuard)
  @Mutation(() => CreateOrderInvoiceResult)
  async createOrderInvoice(
    @Args('orderId', { type: () => ID }) orderId: string,
    @Args('payerInn', { type: () => String, nullable: true })
    payerInn: string | undefined,
    @Args('payerKpp', { type: () => String, nullable: true })
    payerKpp: string | undefined,
    @Args('payerName', { type: () => String, nullable: true })
    payerName: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<CreateOrderInvoiceResult> {
    const payerOverride =
      payerInn ?? payerKpp ?? payerName
        ? { inn: payerInn, kpp: payerKpp, name: payerName }
        : undefined;
    return this.orderService.createOrderInvoice(orderId, user.id, payerOverride);
  }
}
