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

const NUM_EPS = 0.01;

function numEq(a: number, b: number): boolean {
  return Math.abs(Number(a) - Number(b)) < NUM_EPS;
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
  ) {}

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
    for (const line of input.lines) {
      const cartIdx = items.findIndex(
        (i, idx) =>
          !usedCartIndices.has(idx) &&
          i.programId === line.programId &&
          numEq(
            Number(i.program.pricing?.[i.pricingIndex]?.hours ?? 0),
            Number(line.hours),
          ) &&
          numEq(
            Number(i.program.pricing?.[i.pricingIndex]?.price ?? 0),
            Number(line.price),
          ),
      );
      if (cartIdx < 0) {
        const cartSummary = items.map((i) => ({
          programId: i.programId,
          hours: i.program.pricing?.[i.pricingIndex]?.hours,
          price: i.program.pricing?.[i.pricingIndex]?.price,
        }));
        this.logger.warn(
          `createOrderFromCart: line not found in cart userId=${userId} requestLine=${JSON.stringify({ programId: line.programId, hours: line.hours, price: line.price })} cartItems=${JSON.stringify(cartSummary)}`,
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
      orderLines.push({
        program: new Types.ObjectId(line.programId),
        programTitle: cartItem.program.title,
        hours: line.hours,
        price: line.price,
        quantity: line.quantity,
        lineAmount: line.lineAmount,
        learners,
      });
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

    const result = await this.tbankEacqService.initPayment({
      orderId: order._id.toString(),
      amount: Math.round(Number(order.totalAmount) * 100),
      description: `Оплата заказа №${orderId}`.slice(0, 140),
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

    const invoiceNumber = (() => {
      const hex = orderId.replace(/[^a-f0-9]/gi, '').slice(-12);
      const num = parseInt(hex || '0', 16);
      return num.toString().slice(0, 15);
    })();

    const items = (order.lines as OrderLine[]).map((line) => ({
      name: (line.programTitle ?? 'Позиция').slice(0, 1000),
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
      comment: `Заказ №${orderId}`.slice(0, 1000),
      customPaymentPurpose: `Оплата заказа №${orderId}`.slice(0, 512),
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
   * Обновить статус заказа вручную (в работе, выполнен, отменен).
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
    order.status = newStatus;
    await order.save();
    this.logger.log(`updateOrderStatus: orderId=${orderId} -> ${newStatus}`);
    return order;
  }
}
