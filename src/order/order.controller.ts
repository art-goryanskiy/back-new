import { Controller, Get, Param, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

/**
 * Редиректы после оплаты картой (T-Bank EACQ).
 * Укажите в ЛК Т-Банка или в TBANK_EACQ_SUCCESS_URL / TBANK_EACQ_FAIL_URL
 * URL бэкенда, например:
 *   https://your-api.ru/orders/{orderId}/payment-success
 *   https://your-api.ru/orders/{orderId}/payment-fail
 * Тогда после оплаты пользователь попадёт сюда и будет перенаправлен на фронт.
 */
@Controller('orders')
export class OrderController {
  constructor(private readonly configService: ConfigService) {}

  @Get(':orderId/payment-success')
  paymentSuccess(
    @Param('orderId') orderId: string,
    @Res() res: Response,
  ): void {
    const base = this.configService.get<string>('FRONTEND_BASE_URL')?.trim();
    const url = base
      ? `${base.replace(/\/$/, '')}/orders/${encodeURIComponent(orderId)}/success`
      : `/orders/${orderId}/success`;
    res.redirect(302, url);
  }

  @Get(':orderId/payment-fail')
  paymentFail(
    @Param('orderId') orderId: string,
    @Res() res: Response,
  ): void {
    const base = this.configService.get<string>('FRONTEND_BASE_URL')?.trim();
    const url = base
      ? `${base.replace(/\/$/, '')}/orders/${encodeURIComponent(orderId)}/fail`
      : `/orders/${orderId}/fail`;
    res.redirect(302, url);
  }
}
