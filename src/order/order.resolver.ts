import { Args, ID, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from 'src/common/decorators/current-user.decorator';
import { getClientIp } from 'src/user/resolvers/user-auth.resolver.utils';
import {
  OrderEntity,
  CreateOrderInvoiceResult,
  OrderInvoiceInfoResult,
  CreateOrderCardPaymentResult,
  OrderPaymentSyncResult,
} from './order.entity';
import { OrderService } from './order.service';
import {
  CreateOrderFromCartInput,
  MyOrdersFilterInput,
  UpdateOrderInput,
} from './order.input';
import { OrderStatus } from './order.enums';

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
          subProgramIndex?: number;
          subProgramTitle?: string;
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
            dateOfBirth?: Date;
            citizenship?: string;
            passportSeries?: string;
            passportNumber?: string;
            passportIssuedBy?: string;
            passportIssuedAt?: Date;
            passportDepartmentCode?: string;
            snils?: string;
            educationQualification?: string;
            educationDocumentIssuedAt?: Date;
            passportRegistrationAddress?: string;
            residentialAddress?: string;
            workPlaceName?: string;
            position?: string;
          }>;
        }>
      | undefined) ?? [];
  return {
    id,
    number: doc.number as string | undefined,
    userId: (doc.user as { toString: () => string }).toString(),
    customerType: doc.customerType as OrderEntity['customerType'],
    organizationId: (
      doc.organization as { toString?: () => string } | undefined
    )?.toString?.(),
    contactEmail: doc.contactEmail as string | undefined,
    contactPhone: doc.contactPhone as string | undefined,
    status: doc.status as OrderEntity['status'],
    statusChangedAt: doc.statusChangedAt as Date | undefined,
    totalAmount: Number(doc.totalAmount ?? 0),
    lines: lines.map((l) => ({
      programId: (l.program as { toString?: () => string })?.toString?.() ?? '',
      programTitle: l.programTitle ?? '',
      subProgramIndex: l.subProgramIndex,
      subProgramTitle: l.subProgramTitle,
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
        dateOfBirth: ll.dateOfBirth,
        citizenship: ll.citizenship,
        passportSeries: ll.passportSeries,
        passportNumber: ll.passportNumber,
        passportIssuedBy: ll.passportIssuedBy,
        passportIssuedAt: ll.passportIssuedAt,
        passportDepartmentCode: ll.passportDepartmentCode,
        snils: ll.snils,
        educationQualification: ll.educationQualification,
        educationDocumentIssuedAt: ll.educationDocumentIssuedAt,
        passportRegistrationAddress: ll.passportRegistrationAddress,
        residentialAddress: ll.residentialAddress,
        workPlaceName: ll.workPlaceName,
        position: ll.position,
      })),
    })),
    createdAt: (doc.createdAt as Date) ?? new Date(),
    updatedAt: (doc.updatedAt as Date) ?? new Date(),
    trainingStartDate: doc.trainingStartDate as Date | undefined,
    trainingEndDate: doc.trainingEndDate as Date | undefined,
    trainingForm: doc.trainingForm as string | undefined,
    trainingLanguage: doc.trainingLanguage as string | undefined,
    headPosition: doc.headPosition as string | undefined,
    headFullName: doc.headFullName as string | undefined,
    headPositionGenitive: doc.headPositionGenitive as string | undefined,
    headFullNameGenitive: doc.headFullNameGenitive as string | undefined,
    contactPersonName: doc.contactPersonName as string | undefined,
    contactPersonPosition: doc.contactPersonPosition as string | undefined,
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
    @Context() context: { req: Request },
  ): Promise<OrderEntity> {
    const order = await this.orderService.createOrderFromCart(user.id, input, {
      clientIp: getClientIp(context.req),
    });
    return mapToEntity(order as unknown as Parameters<typeof mapToEntity>[0]);
  }

  /** Инициировать оплату картой (T-Bank EACQ) — вернёт paymentId и paymentUrl для формы/iframe */
  @UseGuards(JwtAuthGuard)
  @Mutation(() => CreateOrderCardPaymentResult)
  async createOrderCardPayment(
    @Args('orderId', { type: () => ID }) orderId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<CreateOrderCardPaymentResult> {
    return this.orderService.createCardPayment(orderId, user.id);
  }

  /** Синхронизировать статус заказа с T-Bank EACQ (при CONFIRMED — заказ переводится в PAID) */
  @UseGuards(JwtAuthGuard)
  @Query(() => OrderPaymentSyncResult)
  async orderPaymentSync(
    @Args('orderId', { type: () => ID }) orderId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<OrderPaymentSyncResult> {
    return this.orderService.syncOrderPaymentStatus(orderId, user.id);
  }

  /** Обновить статус заказа. Отменить можно только заказ со статусом «Ожидает оплаты». */
  @UseGuards(JwtAuthGuard)
  @Mutation(() => OrderEntity)
  async updateOrderStatus(
    @Args('orderId', { type: () => ID }) orderId: string,
    @Args('status', { type: () => OrderStatus }) status: OrderStatus,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<OrderEntity> {
    const order = await this.orderService.updateOrderStatus(
      orderId,
      user.id,
      status,
    );
    return mapToEntity(order as unknown as Parameters<typeof mapToEntity>[0]);
  }

  /** Удалить заказ. Разрешено только со статусом «Ожидает оплаты». */
  @UseGuards(JwtAuthGuard)
  @Mutation(() => Boolean)
  async deleteOrder(
    @Args('orderId', { type: () => ID }) orderId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<boolean> {
    return this.orderService.deleteOrder(orderId, user.id);
  }

  /** Редактировать заказ (контакты, организация). Только со статусом «Ожидает оплаты». Организацию можно указать по ID или по ИНН. */
  @UseGuards(JwtAuthGuard)
  @Mutation(() => OrderEntity)
  async updateOrder(
    @Args('orderId', { type: () => ID }) orderId: string,
    @Args('input', { type: () => UpdateOrderInput }) input: UpdateOrderInput,
    @CurrentUser() user: CurrentUserPayload,
    @Context() context: { req: Request },
  ): Promise<OrderEntity> {
    const order = await this.orderService.updateOrder(orderId, user.id, {
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      organizationId: input.organizationId,
      organizationQuery: input.organizationQuery,
      clientIp: getClientIp(context.req),
    });
    return mapToEntity(order as unknown as Parameters<typeof mapToEntity>[0]);
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
      (payerInn ?? payerKpp ?? payerName)
        ? { inn: payerInn, kpp: payerKpp, name: payerName }
        : undefined;
    return this.orderService.createOrderInvoice(
      orderId,
      user.id,
      payerOverride,
    );
  }
}
