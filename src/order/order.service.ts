import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
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
      status: OrderStatus.SUBMITTED,
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
}
