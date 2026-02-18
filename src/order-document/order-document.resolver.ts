import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { BadRequestException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { AdminGuard } from 'src/common/guards/admin.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from 'src/common/decorators/current-user.decorator';
import { OrderDocumentEntity } from './order-document.entity';
import { OrderDocumentService } from './order-document.service';
import { OrderDocumentGenerationService } from './order-document-generation.service';
import { OrderService } from 'src/order/order.service';
import { OrderDocumentKind } from './order-document.schema';
import {
  AdminUpdateOrderDocumentDateInput,
  AdminGenerateOrderDocumentInput,
} from './order-document.input';

function toEntity(doc: {
  _id: unknown;
  order: { toString: () => string };
  kind: string;
  fileUrl: string;
  documentDate: Date;
  createdAt: Date;
  updatedAt: Date;
}): OrderDocumentEntity {
  const id =
    typeof (doc._id as { toString?: () => string })?.toString === 'function'
      ? (doc._id as { toString: () => string }).toString()
      : String(doc._id);
  return {
    id,
    orderId: (doc.order as { toString: () => string }).toString(),
    kind: doc.kind as OrderDocumentKind,
    fileUrl: doc.fileUrl,
    documentDate: doc.documentDate,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

@Resolver(() => OrderDocumentEntity)
export class OrderDocumentResolver {
  constructor(
    private readonly orderDocumentService: OrderDocumentService,
    private readonly orderDocumentGenerationService: OrderDocumentGenerationService,
    private readonly orderService: OrderService,
  ) {}

  /** Документы по заявке (пользователь — только свои заказы). */
  @UseGuards(JwtAuthGuard)
  @Query(() => [OrderDocumentEntity], {
    name: 'orderDocuments',
    description: 'Документы по заявке (заявка на обучение, договор, акт)',
  })
  async orderDocuments(
    @Args('orderId', { type: () => ID }) orderId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<OrderDocumentEntity[]> {
    await this.orderService.findByIdAndUser(orderId, user.id);
    const docs = await this.orderDocumentService.findByOrder(orderId);
    return docs.map((d) =>
      toEntity(d as unknown as Parameters<typeof toEntity>[0]),
    );
  }

  /** Документы по заявке (админ — любой заказ). */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Query(() => [OrderDocumentEntity], {
    name: 'adminOrderDocuments',
    description: 'Документы по заявке (только для админа)',
  })
  async adminOrderDocuments(
    @Args('orderId', { type: () => ID }) orderId: string,
    @CurrentUser() _user: CurrentUserPayload,
  ): Promise<OrderDocumentEntity[]> {
    await this.orderService.findById(orderId);
    const docs = await this.orderDocumentService.findByOrder(orderId);
    return docs.map((d) =>
      toEntity(d as unknown as Parameters<typeof toEntity>[0]),
    );
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Mutation(() => OrderDocumentEntity, {
    name: 'adminUpdateOrderDocumentDate',
    description: 'Изменить дату документа (только для админа)',
  })
  async adminUpdateOrderDocumentDate(
    @Args('input') input: AdminUpdateOrderDocumentDateInput,
    @CurrentUser() _user: CurrentUserPayload,
  ): Promise<OrderDocumentEntity> {
    const doc = await this.orderDocumentService.updateDocumentDate(
      input.orderDocumentId,
      input.documentDate,
    );
    return toEntity(doc as unknown as Parameters<typeof toEntity>[0]);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Mutation(() => OrderDocumentEntity, {
    name: 'adminGenerateOrderContract',
    description: 'Сформировать договор по заявке (только для админа)',
  })
  async adminGenerateOrderContract(
    @Args('input') input: AdminGenerateOrderDocumentInput,
    @CurrentUser() _user: CurrentUserPayload,
  ): Promise<OrderDocumentEntity> {
    const doc =
      await this.orderDocumentGenerationService.generateAndSaveContract(
        input.orderId,
        input.documentDate,
      );
    if (!doc) throw new BadRequestException('Не удалось сформировать договор');
    return toEntity(doc as unknown as Parameters<typeof toEntity>[0]);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Mutation(() => OrderDocumentEntity, {
    name: 'adminGenerateOrderAct',
    description:
      'Сформировать акт оказанных услуг по заявке (только для админа)',
  })
  async adminGenerateOrderAct(
    @Args('input') input: AdminGenerateOrderDocumentInput,
    @CurrentUser() _user: CurrentUserPayload,
  ): Promise<OrderDocumentEntity> {
    const doc = await this.orderDocumentGenerationService.generateAndSaveAct(
      input.orderId,
      input.documentDate,
    );
    if (!doc) throw new BadRequestException('Не удалось сформировать акт');
    return toEntity(doc as unknown as Parameters<typeof toEntity>[0]);
  }

  /** Сформировать заявку на обучение по заказу (только для админа). Временно разрешено для любого статуса заказа. */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Mutation(() => OrderDocumentEntity, {
    name: 'adminGenerateOrderTrainingApplication',
    description:
      'Сформировать заявку на обучение по заказу (только для админа)',
  })
  async adminGenerateOrderTrainingApplication(
    @Args('orderId', { type: () => ID }) orderId: string,
    @CurrentUser() _user: CurrentUserPayload,
  ): Promise<OrderDocumentEntity> {
    await this.orderService.findById(orderId);
    // Временно: разрешаем генерацию для любого заказа (в т.ч. не оплаченного). Вернуть проверку: if (order.status !== OrderStatus.PAID) throw ...
    const result =
      await this.orderDocumentGenerationService.generateAndSaveTrainingApplication(
        orderId,
      );
    if (!result)
      throw new BadRequestException(
        'Не удалось сформировать заявку на обучение',
      );
    const doc = await this.orderDocumentService.findById(
      result.orderDocumentId,
    );
    return toEntity(doc as unknown as Parameters<typeof toEntity>[0]);
  }
}
