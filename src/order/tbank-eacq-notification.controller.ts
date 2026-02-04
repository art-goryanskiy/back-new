import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { TbankEacqService } from '../payment/tbank-eacq.service';

/**
 * Уведомления T-Bank EACQ о смене статуса платежа (NotificationURL).
 * Т-Банк вызывает POST /payment/tbank-eacq/notification при успешной оплате.
 * Проверяем токен, при Success и Status=CONFIRMED переводим заказ в PAID.
 */
@Controller('payment/tbank-eacq')
export class TbankEacqNotificationController {
  constructor(
    private readonly orderService: OrderService,
    private readonly tbankEacqService: TbankEacqService,
  ) {}

  @Post('notification')
  @HttpCode(HttpStatus.OK)
  async notification(
    @Body() body: Record<string, unknown>,
  ): Promise<{ ok: boolean }> {
    if (!this.tbankEacqService.verifyNotification(body)) {
      throw new ForbiddenException('Invalid notification token');
    }

    const success = body.Success === true;
    const status = body.Status;
    const orderId = body.OrderId;

    if (
      !success ||
      status !== 'CONFIRMED' ||
      typeof orderId !== 'string' ||
      !orderId.trim()
    ) {
      return { ok: true };
    }

    await this.orderService.setOrderPaidByOrderId(orderId.trim());
    return { ok: true };
  }
}
