import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Order,
  OrderLine,
  OrderLineLearner,
  type OrderDocument,
} from './order.schema';
import { OrderStatus, OrderCustomerType } from './order.enums';
import type {
  CreateOrderFromCartInput,
  CreateOrderLineInput,
} from './order.input';
import { CartService } from '../cart/cart.service';
import { UserService } from '../user/user.service';
import { TbankInvoiceService } from '../payment/tbank-invoice.service';
import { TbankEacqService } from '../payment/tbank-eacq.service';
import { OrganizationService } from '../organization/organization.service';
import { CategoryService } from '../category/category.service';
import { buildProgramDisplayTitle } from '../common/utils/program-display-title';

const NUM_EPS = 0.01;
const ORDER_NUMBER_PREFIX = 'E-';
const ORDER_NUMBER_DIGITS = 6;
const COUNTER_ID_ORDER_NUMBER = 'orderNumber';

function numEq(a: number, b: number): boolean {
  return Math.abs(Number(a) - Number(b)) < NUM_EPS;
}

/** Форматирует номер заявки: E-000001 */
function formatOrderNumber(seq: number): string {
  const s = String(seq);
  if (s.length > ORDER_NUMBER_DIGITS) {
    return `${ORDER_NUMBER_PREFIX}${s.slice(-ORDER_NUMBER_DIGITS)}`;
  }
  return `${ORDER_NUMBER_PREFIX}${s.padStart(ORDER_NUMBER_DIGITS, '0')}`;
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    private readonly cartService: CartService,
    private readonly userService: UserService,
    private readonly tbankInvoiceService: TbankInvoiceService,
    private readonly tbankEacqService: TbankEacqService,
    private readonly configService: ConfigService,
    private readonly organizationService: OrganizationService,
    private readonly categoryService: CategoryService,
  ) {}

  /**
   * Атомарно получает следующий порядковый номер заявки (E-000001, E-000002, ...).
   * Использует коллекцию counters с документом { _id: 'orderNumber', value: number }.
   */
  private async getNextOrderNumber(): Promise<string> {
    const col = this.orderModel.db.collection<{ _id: string; value: number }>(
      'counters',
    );
    const r = await col.findOneAndUpdate(
      { _id: COUNTER_ID_ORDER_NUMBER },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: 'after' },
    );
    const seq = r?.value ?? 1;
    return formatOrderNumber(seq);
  }

  async createOrderFromCart(
    userId: string,
    input: CreateOrderFromCartInput,
  ): Promise<OrderDocument> {
    const { items, totalAmount } =
      await this.cartService.getCartWithEnrichedItems(userId);

    if (items.length === 0) {
      this.logger.warn(`createOrderFromCart: cart empty for userId=${userId}`);
      throw new BadRequestException(
        'Корзина пуста. Добавьте программы в корзину перед оформлением заказа.',
      );
    }

    if (input.customerType === OrderCustomerType.ORGANIZATION) {
      if (!input.organizationId) {
        throw new BadRequestException(
          'organizationId is required when customerType is ORGANIZATION',
        );
      }
      const profile = await this.userService.getProfileByUserId(userId);
      const workPlaceOrgIds =
        profile?.workPlaces?.map((w) => w.organization?.toString()) ?? [];
      if (!workPlaceOrgIds.includes(input.organizationId)) {
        throw new BadRequestException(
          'You can only place orders for organizations in your work places',
        );
      }
    }

    const orderLines: OrderLine[] = [];
    const usedCartIndices = new Set<number>();
    const lineSubProgramIndex = (line: CreateOrderLineInput) =>
      line.subProgramIndex !== undefined && line.subProgramIndex !== null
        ? line.subProgramIndex
        : undefined;
    for (const line of input.lines) {
      const wantSub = lineSubProgramIndex(line);
      const cartIdx = items.findIndex(
        (i, idx) => {
          if (usedCartIndices.has(idx)) return false;
          if (i.programId !== line.programId) return false;
          const sameSub =
            (i.subProgramIndex ?? undefined) === wantSub;
          if (!sameSub) return false;
          if (
            !numEq(
              Number(i.program.pricing?.[i.pricingIndex]?.hours ?? 0),
              Number(line.hours),
            )
          )
            return false;
          if (
            !numEq(
              Number(i.program.pricing?.[i.pricingIndex]?.price ?? 0),
              Number(line.price),
            )
          )
            return false;
          return true;
        },
      );
      if (cartIdx < 0) {
        const cartSummary = items.map((i) => ({
          programId: i.programId,
          subProgramIndex: i.subProgramIndex,
          hours: i.program.pricing?.[i.pricingIndex]?.hours,
          price: i.program.pricing?.[i.pricingIndex]?.price,
        }));
        this.logger.warn(
          `createOrderFromCart: line not found in cart userId=${userId} requestLine=${JSON.stringify({ programId: line.programId, subProgramIndex: line.subProgramIndex, hours: line.hours, price: line.price })} cartItems=${JSON.stringify(cartSummary)}`,
        );
        throw new BadRequestException(
          `Позиция не найдена в корзине: программа ${line.programId}, ${line.hours} ч / ${line.price} ₽. Обновите корзину или добавьте программу снова.`,
        );
      }
      usedCartIndices.add(cartIdx);
      const cartItem = items[cartIdx];
      const expectedLineAmount = cartItem.lineAmount;
      if (!numEq(line.lineAmount, expectedLineAmount)) {
        this.logger.warn(
          `createOrderFromCart: lineAmount mismatch userId=${userId} line=${line.lineAmount} expected=${expectedLineAmount}`,
        );
        throw new BadRequestException(
          'Сумма по позиции не совпадает с корзиной. Обновите страницу корзины.',
        );
      }
      const learners: OrderLineLearner[] = line.learners.map((l) => ({
        lastName: l.lastName,
        firstName: l.firstName,
        middleName: l.middleName,
        email: l.email,
        phone: l.phone,
      }));
      let categoryType: string | undefined;
      try {
        const category = await this.categoryService.findOne(
          cartItem.program.category.toString(),
        );
        categoryType = category?.type;
      } catch {
        categoryType = undefined;
      }
      const orderLine: OrderLine = {
        program: new Types.ObjectId(line.programId),
        programTitle: buildProgramDisplayTitle(
          categoryType,
          cartItem.program.title,
        ),
        hours: line.hours,
        price: line.price,
        quantity: line.quantity,
        lineAmount: line.lineAmount,
        learners,
      };
      if (cartItem.subProgramIndex !== undefined && cartItem.subProgramTitle) {
        orderLine.subProgramIndex = cartItem.subProgramIndex;
        orderLine.subProgramTitle = buildProgramDisplayTitle(
          categoryType,
          cartItem.subProgramTitle,
        );
      }
      orderLines.push(orderLine);
    }

    const computedTotal = orderLines.reduce((s, l) => s + l.lineAmount, 0);
    if (!numEq(computedTotal, totalAmount)) {
      this.logger.warn(
        `createOrderFromCart: total mismatch userId=${userId} computed=${computedTotal} cartTotal=${totalAmount}`,
      );
      throw new BadRequestException(
        'Итоговая сумма заказа не совпадает с корзиной. Обновите страницу корзины.',
      );
    }

    const orderNumber = await this.getNextOrderNumber();
    const order = await this.orderModel.create({
      user: new Types.ObjectId(userId),
      customerType: input.customerType,
      organization:
        input.customerType === OrderCustomerType.ORGANIZATION &&
        input.organizationId
          ? new Types.ObjectId(input.organizationId)
          : undefined,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      number: orderNumber,
      status: OrderStatus.AWAITING_PAYMENT,
      totalAmount: computedTotal,
      lines: orderLines,
    });

    await this.cartService.clearCart(userId);
    this.logger.log(
      `createOrderFromCart: order created orderId=${order._id} userId=${userId} total=${computedTotal}`,
    );
    return order;
  }

  async findMyOrders(
    userId: string,
    opts?: { status?: OrderStatus; limit?: number; offset?: number },
  ): Promise<OrderDocument[]> {
    const filter: Record<string, unknown> = {
      user: new Types.ObjectId(userId),
    };
    if (opts?.status) filter.status = opts.status;

    const docs = await this.orderModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(opts?.offset ?? 0)
      .limit(Math.min(opts?.limit ?? 50, 100))
      .exec();
    return docs as OrderDocument[];
  }

  async findByIdAndUser(
    orderId: string,
    userId: string,
  ): Promise<OrderDocument> {
    const order = await this.orderModel
      .findOne({
        _id: new Types.ObjectId(orderId),
        user: new Types.ObjectId(userId),
      })
      .exec();
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async createCardPayment(
    orderId: string,
    userId: string,
  ): Promise<{ paymentId: string; paymentUrl: string; status?: string }> {
    const order = await this.findByIdAndUser(orderId, userId);
    if (order.status === OrderStatus.PAID) {
      throw new BadRequestException('Заказ уже оплачен');
    }
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Заказ отменён');
    }

    const successUrlRaw = this.configService.get<string>('TBANK_EACQ_SUCCESS_URL');
    const failUrlRaw = this.configService.get<string>('TBANK_EACQ_FAIL_URL');
    const frontendBase = this.configService.get<string>('FRONTEND_BASE_URL')?.trim();
    const successUrl = successUrlRaw?.trim()
      ? successUrlRaw.trim().replace(/\{orderId\}/g, orderId)
      : frontendBase
        ? `${frontendBase.replace(/\/$/, '')}/orders/${orderId}/success`
        : undefined;
    const failUrl = failUrlRaw?.trim()
      ? failUrlRaw.trim().replace(/\{orderId\}/g, orderId)
      : frontendBase
        ? `${frontendBase.replace(/\/$/, '')}/orders/${orderId}/fail`
        : undefined;

    const backendBase = this.configService.get<string>('BACKEND_PUBLIC_URL')?.trim();
    const notificationUrl = backendBase
      ? `${backendBase.replace(/\/$/, '')}/payment/tbank-eacq/notification`
      : undefined;

    // T-Bank EACQ требует уникальный OrderId для каждой попытки оплаты. При повторном Init
    // с тем же OrderId (например, пользователь вернулся и снова нажал «Оплатить») T-Bank
    // возвращает «Неверный статус транзакции». Суффикс по времени обеспечивает уникальность
    // (OrderId в EACQ — до 36 символов; наш _id — 24, суффикс _ + 10 цифр = 35).
    const uniqueOrderId =
      order._id.toString() + '_' + String(Date.now()).slice(-10);
    const orderLabel = order.number ?? orderId;
    const result = await this.tbankEacqService.initPayment({
      orderId: uniqueOrderId,
      amount: Math.round(Number(order.totalAmount) * 100),
      description: `Оплата заказа №${orderLabel}`.slice(0, 140),
      successUrl,
      failUrl,
      notificationUrl,
    });

    this.logger.log(
      `createCardPayment: orderId=${orderId} paymentId=${result.paymentId}`,
    );

    return {
      paymentId: result.paymentId,
      paymentUrl: result.paymentUrl,
      status: result.status,
    };
  }

  async createOrderInvoice(
    orderId: string,
    userId: string,
    payerOverride?: { inn?: string; kpp?: string; name?: string },
  ): Promise<{ pdfUrl: string; invoiceId: string; incomingInvoiceUrl?: string }> {
    const order = await this.findByIdAndUser(orderId, userId);
    if (order.status === OrderStatus.PAID) {
      throw new BadRequestException('Заказ уже оплачен');
    }
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Заказ отменён');
    }

    if (order.invoiceId && order.invoicePdfUrl) {
      this.logger.log(`createOrderInvoice: orderId=${orderId} already has invoice, returning existing`);
      return {
        pdfUrl: order.invoicePdfUrl,
        invoiceId: order.invoiceId,
      };
    }

    const accountNumber =
      this.configService.get<string>('TBANK_SBP_ACCOUNT_NUMBER') ?? '';
    if (!/^(\d{20}|\d{22})$/.test(accountNumber)) {
      throw new BadRequestException(
        'TBANK_SBP_ACCOUNT_NUMBER не задан или неверный формат',
      );
    }

    const vat = this.configService.get<string>('TBANK_SBP_VAT') ?? '22';
    const dueDays = Number(
      this.configService.get<string>('TBANK_INVOICE_DUE_DAYS') ?? '7',
    );
    const now = new Date();
    const invoiceDate = now.toISOString().slice(0, 10);
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + dueDays);
    const dueDateStr = dueDate.toISOString().slice(0, 10);

    let payerName: string;
    let payerInn: string;
    let payerKpp: string;

    if (order.customerType === OrderCustomerType.ORGANIZATION && order.organization) {
      const org = await this.organizationService.findById(
        (order.organization as Types.ObjectId).toString(),
      );
      payerName = payerOverride?.name ?? org.displayName ?? org.fullName ?? org.shortName ?? org.inn;
      payerInn = payerOverride?.inn ?? org.inn;
      payerKpp = payerOverride?.kpp ?? org.kpp ?? '000000000';
      if (!/^\d{9}$/.test(payerKpp)) payerKpp = '000000000';
    } else {
      const profile = await this.userService.getProfileByUserId(userId);
      const parts = [
        profile?.lastName,
        profile?.firstName,
        profile?.middleName,
      ].filter(Boolean);
      payerName = payerOverride?.name ?? (parts.join(' ').trim() || 'Плательщик');
      payerInn = payerOverride?.inn?.trim() ?? '';
      payerKpp = payerOverride?.kpp?.trim() ?? '000000000';
      if (!/^(\d{12}|\d{10})$/.test(payerInn)) {
        throw new BadRequestException(
          'Для физлица/ИП укажите ИНН плательщика (payerInn в мутации createOrderInvoice)',
        );
      }
      if (!/^\d{9}$/.test(payerKpp)) payerKpp = '000000000';
    }

    const orderLabel = order.number ?? orderId;
    const invoiceNumber = (() => {
      if (order.number && /^E-(\d+)$/.test(order.number)) {
        const num = parseInt(order.number.replace(/^E-/, ''), 10);
        return String(num).slice(0, 15);
      }
      const hex = orderId.replace(/[^a-f0-9]/gi, '').slice(-12);
      const num = parseInt(hex || '0', 16);
      return num.toString().slice(0, 15);
    })();

    const items = (order.lines as OrderLine[]).map((line) => ({
      name: (line.subProgramTitle ?? line.programTitle ?? 'Позиция').slice(0, 1000),
      price: Number(line.price),
      unit: 'шт',
      vat,
      amount: Number(line.quantity),
    }));

    const user = await this.userService.findById(userId);
    const contactEmail = order.contactEmail ?? user?.email ?? '';
    if (!contactEmail.trim()) {
      throw new BadRequestException(
        'Укажите email для получения счёта (contactEmail в заказе или email пользователя)',
      );
    }

    let contactPhone: string | undefined = order.contactPhone?.trim();
    if (contactPhone && !/^(\+7)([0-9]){10}$/.test(contactPhone)) {
      const digits = contactPhone.replace(/\D/g, '');
      if (digits.length === 10) contactPhone = `+7${digits}`;
      else if (digits.length === 11 && digits.startsWith('7'))
        contactPhone = `+7${digits.slice(1)}`;
      else contactPhone = undefined;
    }
    if (contactPhone && !/^(\+7)([0-9]){10}$/.test(contactPhone))
      contactPhone = undefined;

    const result = await this.tbankInvoiceService.sendInvoice({
      invoiceNumber,
      dueDate: dueDateStr,
      invoiceDate: invoiceDate,
      accountNumber,
      payer: {
        name: payerName.slice(0, 512),
        inn: payerInn,
        kpp: payerKpp,
      },
      items,
      contacts: [{ email: contactEmail }],
      contactPhone,
      comment: `Заказ №${orderLabel}`.slice(0, 1000),
      customPaymentPurpose: `Оплата заказа №${orderLabel}`.slice(0, 512),
    });

    order.invoiceId = result.invoiceId;
    order.invoicePdfUrl = result.pdfUrl;
    order.invoiceSentAt = new Date();
    await order.save();

    this.logger.log(
      `createOrderInvoice: orderId=${orderId} invoiceId=${result.invoiceId}`,
    );

    return {
      pdfUrl: result.pdfUrl,
      invoiceId: result.invoiceId,
      incomingInvoiceUrl: result.incomingInvoiceUrl,
    };
  }

  async getOrderInvoiceStatus(
    orderId: string,
    userId: string,
  ): Promise<{ status: string }> {
    const order = await this.findByIdAndUser(orderId, userId);
    if (!order.invoiceId) {
      throw new BadRequestException(
        'По этому заказу счёт не выставлен. Сначала вызовите createOrderInvoice.',
      );
    }
    return this.tbankInvoiceService.getInvoiceInfo(order.invoiceId);
  }

  /**
   * Установить заказу статус PAID по OrderId (вызывается из webhook T-Bank EACQ).
   */
  async setOrderPaidByOrderId(orderId: string): Promise<boolean> {
    let order: OrderDocument | null;
    try {
      order = await this.orderModel
        .findById(new Types.ObjectId(orderId))
        .exec();
    } catch {
      order = null;
    }
    if (!order) {
      this.logger.warn(`setOrderPaidByOrderId: order not found orderId=${orderId}`);
      return false;
    }
    if (order.status === OrderStatus.PAID) return true;
    if (order.status === OrderStatus.CANCELLED) return false;
    order.status = OrderStatus.PAID;
    await order.save();
    this.logger.log(`setOrderPaidByOrderId: orderId=${orderId} -> PAID`);
    return true;
  }

  /**
   * Синхронизировать статус заказа с T-Bank EACQ: при статусе CONFIRMED у платежа — выставить заказу PAID.
   */
  async syncOrderPaymentStatus(
    orderId: string,
    userId: string,
  ): Promise<{ status: OrderStatus; updated: boolean; payments?: Array<{ paymentId?: string; status?: string }> }> {
    const order = await this.findByIdAndUser(orderId, userId);
    const result = await this.tbankEacqService.getOrderState(
      order._id.toString(),
    );
    if (!result.success) {
      return {
        status: order.status,
        updated: false,
      };
    }
    const hasConfirmed = (result.payments ?? []).some(
      (p) => p.status === 'CONFIRMED',
    );
    if (hasConfirmed && order.status !== OrderStatus.PAID) {
      order.status = OrderStatus.PAID;
      await order.save();
      this.logger.log(`syncOrderPaymentStatus: orderId=${orderId} -> PAID`);
      return {
        status: OrderStatus.PAID,
        updated: true,
        payments: result.payments,
      };
    }
    return {
      status: order.status,
      updated: false,
      payments: result.payments,
    };
  }

  /**
   * Обновить статус заказа вручную.
   * Отменить (CANCELLED) пользователь может только заказ со статусом «Ожидает оплаты».
   */
  async updateOrderStatus(
    orderId: string,
    userId: string,
    newStatus: OrderStatus,
  ): Promise<OrderDocument> {
    const order = await this.findByIdAndUser(orderId, userId);
    const allowed = [
      OrderStatus.IN_PROGRESS,
      OrderStatus.COMPLETED,
      OrderStatus.CANCELLED,
    ];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Можно установить только статус: ${allowed.join(', ')}`,
      );
    }
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Заказ уже отменён');
    }
    if (order.status === OrderStatus.COMPLETED) {
      throw new BadRequestException('Заказ уже выполнен');
    }
    if (newStatus === OrderStatus.CANCELLED && order.status !== OrderStatus.AWAITING_PAYMENT) {
      throw new BadRequestException(
        'Отменить можно только заказ со статусом «Ожидает оплаты»',
      );
    }
    order.status = newStatus;
    await order.save();
    this.logger.log(`updateOrderStatus: orderId=${orderId} -> ${newStatus}`);
    return order;
  }

  /**
   * Удалить заказ. Разрешено только для заказов со статусом «Ожидает оплаты».
   */
  async deleteOrder(orderId: string, userId: string): Promise<boolean> {
    const order = await this.findByIdAndUser(orderId, userId);
    if (order.status !== OrderStatus.AWAITING_PAYMENT) {
      throw new BadRequestException(
        'Удалить можно только заказ со статусом «Ожидает оплаты»',
      );
    }
    await this.orderModel.deleteOne({ _id: order._id }).exec();
    this.logger.log(`deleteOrder: orderId=${orderId} userId=${userId}`);
    return true;
  }

  /**
   * Редактировать заказ (контакты, организация). Разрешено только при статусе «Ожидает оплаты».
   */
  async updateOrder(
    orderId: string,
    userId: string,
    input: { contactEmail?: string; contactPhone?: string; organizationId?: string | null },
  ): Promise<OrderDocument> {
    const order = await this.findByIdAndUser(orderId, userId);
    if (order.status !== OrderStatus.AWAITING_PAYMENT) {
      throw new BadRequestException(
        'Редактировать можно только заказ со статусом «Ожидает оплаты»',
      );
    }
    if (input.contactEmail !== undefined) order.contactEmail = input.contactEmail ?? undefined;
    if (input.contactPhone !== undefined) order.contactPhone = input.contactPhone ?? undefined;
    if (input.organizationId !== undefined && order.customerType === OrderCustomerType.ORGANIZATION) {
      if (input.organizationId) {
        const profile = await this.userService.getProfileByUserId(userId);
        const workPlaceOrgIds =
          profile?.workPlaces?.map((w) => w.organization?.toString()) ?? [];
        if (!workPlaceOrgIds.includes(input.organizationId)) {
          throw new BadRequestException(
            'Можно указать только организацию из ваших мест работы',
          );
        }
        order.organization = new Types.ObjectId(input.organizationId);
      } else {
        order.organization = undefined;
      }
    }
    await order.save();
    this.logger.log(`updateOrder: orderId=${orderId}`);
    return order;
  }
}
