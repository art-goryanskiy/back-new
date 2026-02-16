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
 * Проверяем токен, при Success и Status=CONFIRMED переводим заказ в PAID
 * и отправляем письмо «Оплата получена». Заявку на обучение формирует только администратор.
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
    const orderIdFromTbank = body.OrderId;

    if (
      !success ||
      status !== 'CONFIRMED' ||
      typeof orderIdFromTbank !== 'string' ||
      !orderIdFromTbank.trim()
    ) {
      return { ok: true };
    }

    // Init вызывается с уникальным OrderId вида orderId_timestamp; в уведомлении
    // T-Bank присылает тот же идентификатор. Наш id заказа — первые 24 символа (MongoDB ObjectId).
    const realOrderId = orderIdFromTbank.trim().slice(0, 24);
    const updated = await this.orderService.setOrderPaidByOrderId(realOrderId);
    if (updated) {
      void this.orderService
        .sendPaymentReceivedEmail(realOrderId)
        .catch((err) => {
          console.error('sendPaymentReceivedEmail failed:', err);
        });
    }
    return { ok: true };
  }
}
