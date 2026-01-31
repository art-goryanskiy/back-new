import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Order,
  OrderLine,
  OrderLineLearner,
  OrderStatus,
  OrderCustomerType,
  type OrderDocument,
} from './order.schema';
import type { CreateOrderFromCartInput, CreateOrderLineInput } from './order.input';
import { CartService } from 'src/cart/cart.service';
import { OrganizationService } from 'src/organization/organization.service';
import { UserService } from 'src/user/user.service';
import type { EnrichedCartItem } from 'src/cart/cart.service';

@Injectable()
export class OrderService {
  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    private readonly cartService: CartService,
    private readonly organizationService: OrganizationService,
    private readonly userService: UserService,
  ) {}

  async createOrderFromCart(
    userId: string,
    input: CreateOrderFromCartInput,
  ): Promise<OrderDocument> {
    const { items: cartItems, totalAmount } = await this.cartService.getCartWithEnrichedItems(userId);
    if (cartItems.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const cartByKey = new Map<string, EnrichedCartItem>();
    for (const item of cartItems) {
      const key = `${item.programId}:${item.pricingIndex}`;
      cartByKey.set(key, item);
    }

    if (input.customerType === OrderCustomerType.ORGANIZATION) {
      if (!input.organizationId?.trim()) {
        throw new BadRequestException('organizationId is required for organization customer');
      }
      await this.organizationService.findById(input.organizationId);

      const profile = await this.userService.getProfileByUserId(userId);
      const allowedOrgIds = new Set<string>();
      if (profile?.workPlaces?.length) {
        for (const wp of profile.workPlaces) {
          const oid = (wp.organization as Types.ObjectId)?.toString?.() ?? String(wp.organization);
          if (oid) allowedOrgIds.add(oid);
        }
      }
      if (profile?.workPlaceId) {
        allowedOrgIds.add(profile.workPlaceId.toString());
      }
      if (!allowedOrgIds.has(input.organizationId.trim())) {
        throw new ForbiddenException(
          'You can only place orders for organizations in your work places',
        );
      }
    }

    const orderLines: OrderLine[] = [];
    let computedTotal = 0;

    for (const line of input.lines) {
      const key = `${line.programId}:${line.pricingIndex}`;
      const cartItem = cartByKey.get(key);
      if (!cartItem) {
        throw new BadRequestException(
          `Cart does not contain program ${line.programId} with pricing index ${line.pricingIndex}`,
        );
      }
      if (line.quantity !== cartItem.quantity) {
        throw new BadRequestException(
          `Quantity mismatch for program ${line.programId}: expected ${cartItem.quantity}`,
        );
      }
      if (!Array.isArray(line.learners) || line.learners.length !== line.quantity) {
        throw new BadRequestException(
          `Learners count must equal quantity (${line.quantity}) for program ${line.programId}`,
        );
      }

      const tier = cartItem.program.pricing?.[line.pricingIndex];
      const price = typeof tier?.price === 'number' ? tier.price : 0;
      const lineAmount = price * line.quantity;
      computedTotal += lineAmount;

      const learners: OrderLineLearner[] = line.learners.map((l) => ({
        lastName: (l.lastName ?? '').trim(),
        firstName: (l.firstName ?? '').trim(),
        middleName: l.middleName?.trim(),
        email: l.email?.trim(),
        phone: l.phone?.trim(),
      }));

      orderLines.push({
        program: new Types.ObjectId(line.programId),
        programTitle: cartItem.program.title,
        hours: tier?.hours ?? 0,
        price,
        quantity: line.quantity,
        lineAmount,
        learners,
      });
    }

    if (Math.abs(computedTotal - totalAmount) > 0.01) {
      throw new BadRequestException('Order total does not match cart total');
    }

    const order = await this.orderModel.create({
      user: new Types.ObjectId(userId),
      customerType: input.customerType,
      organization:
        input.customerType === OrderCustomerType.ORGANIZATION && input.organizationId
          ? new Types.ObjectId(input.organizationId)
          : undefined,
      contactEmail: input.contactEmail?.trim(),
      contactPhone: input.contactPhone?.trim(),
      status: OrderStatus.SUBMITTED,
      totalAmount: computedTotal,
      lines: orderLines,
    });

    await this.cartService.clearCart(userId);
    return order;
  }

  async findMyOrders(
    userId: string,
    filter?: { status?: string; limit?: number; offset?: number },
  ): Promise<OrderDocument[]> {
    const query: Record<string, unknown> = { user: new Types.ObjectId(userId) };
    if (filter?.status?.trim()) {
      query.status = filter.status.trim();
    }
    const limit = Math.min(Math.max(1, Math.floor(filter?.limit ?? 50)), 100);
    const offset = Math.max(0, Math.floor(filter?.offset ?? 0));
    return this.orderModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .exec();
  }

  async findByIdAndUser(orderId: string, userId: string): Promise<OrderDocument> {
    const order = await this.orderModel.findOne({
      _id: new Types.ObjectId(orderId),
      user: new Types.ObjectId(userId),
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }
}
