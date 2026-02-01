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
import { TbankSbpService } from '../payment/tbank-sbp.service';
import { TbankInvoiceService } from '../payment/tbank-invoice.service';
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
    private readonly tbankSbpService: TbankSbpService,
    private readonly tbankInvoiceService: TbankInvoiceService,
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
      status: OrderStatus.PAYMENT_PENDING,
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

  async createSbpPaymentLink(
    orderId: string,
    userId: string,
  ): Promise<{ url: string; qrId: string; dueDate: Date; qrImageBase64?: string }> {
    const order = await this.findByIdAndUser(orderId, userId);
    if (order.status === OrderStatus.PAID) {
      throw new BadRequestException('Заказ уже оплачен');
    }
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Заказ отменён');
    }

    const redirectBase = this.configService.get<string>(
      'TBANK_SBP_REDIRECT_BASE_URL',
    );
    if (!redirectBase?.trim()) {
      throw new BadRequestException(
        'TBANK_SBP_REDIRECT_BASE_URL не задан в .env',
      );
    }
    const redirectUrl = `${redirectBase.replace(/\/$/, '')}/orders/${orderId}/success`;

    const result = await this.tbankSbpService.createOneTimeLink({
      sum: order.totalAmount,
      purpose: `Оплата заказа №${orderId}`,
      redirectUrl,
    });

    order.sbpLinkId = result.qrId;
    order.sbpLinkUrl = result.paymentUrl;
    order.sbpLinkExpiresAt = result.dueDate;
    await order.save();

    this.logger.log(
      `createSbpPaymentLink: orderId=${orderId} qrId=${result.qrId}`,
    );

    return {
      url: result.paymentUrl,
      qrId: result.qrId,
      dueDate: result.dueDate,
      qrImageBase64: result.qrImageBase64,
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

  async getOrderSbpLinkStatus(
    orderId: string,
    userId: string,
  ): Promise<{
    qrId: string;
    paymentUrl: string;
    type: string;
    status: string;
    accountNumber: string;
  }> {
    const order = await this.findByIdAndUser(orderId, userId);
    if (!order.sbpLinkId) {
      throw new BadRequestException(
        'По этому заказу ссылка СБП не создана. Сначала вызовите createOrderSbpLink.',
      );
    }
    return this.tbankSbpService.getQrLinkInfo(order.sbpLinkId);
  }
}
