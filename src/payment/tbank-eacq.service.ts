import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

const EACQ_INIT_PATH = '/v2/Init';
const EACQ_GET_STATE_PATH = '/v2/GetState';
const EACQ_GET_ORDER_STATE_PATH = '/v2/GetOrderState';
const EACQ_BASE_PROD = 'https://securepay.tinkoff.ru';
const EACQ_BASE_TEST = 'https://rest-api-test.tinkoff.ru';

export interface TbankEacqInitParams {
  orderId: string;
  amount: number;
  description: string;
  /** Если не задан — Т-Банк использует страницы по умолчанию из ЛК */
  successUrl?: string;
  failUrl?: string;
  notificationUrl?: string;
}

export interface TbankEacqInitResponse {
  Success: boolean;
  ErrorCode?: string;
  Message?: string;
  TerminalKey?: string;
  Status?: string;
  PaymentId?: string;
  OrderId?: string;
  PaymentURL?: string;
}

export interface TbankEacqGetStateResponse {
  Success: boolean;
  ErrorCode?: string;
  Message?: string;
  TerminalKey?: string;
  Status?: string;
  PaymentId?: string;
  OrderId?: string;
  Amount?: number;
  Params?: Array<{ Key: string; Value: string }>;
}

export interface TbankEacqPaymentItem {
  PaymentId?: string;
  Status?: string;
  OrderId?: string;
  Amount?: number;
  [key: string]: unknown;
}

export interface TbankEacqGetOrderStateResponse {
  Success: boolean;
  ErrorCode?: string;
  Message?: string;
  TerminalKey?: string;
  OrderId?: string;
  Details?: string;
  Payments?: TbankEacqPaymentItem[];
}

@Injectable()
export class TbankEacqService {
  private readonly logger = new Logger(TbankEacqService.name);

  constructor(private readonly configService: ConfigService) {}

  private getBaseUrl(): string {
    const useTest = this.configService.get<string>('TBANK_EACQ_USE_TEST');
    return useTest === 'true' ? EACQ_BASE_TEST : EACQ_BASE_PROD;
  }

  private async eacqPost<T>(
    path: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const password = this.configService.get<string>('TBANK_EACQ_PASSWORD');
    if (!password?.trim()) {
      throw new BadRequestException(
        'TBANK_EACQ_PASSWORD должен быть задан в .env',
      );
    }
    (body as Record<string, string>).Token = this.buildToken(
      body,
      password.trim(),
    );
    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}${path}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new BadRequestException(
        `T-Bank EACQ: неверный ответ (${response.status}). ${text.slice(0, 200)}`,
      );
    }
  }

  /**
   * Проверка токена уведомления от T-Bank EACQ (тот же алгоритм: поля + Password, SHA-256).
   */
  verifyNotification(body: Record<string, unknown>): boolean {
    const password = this.configService.get<string>('TBANK_EACQ_PASSWORD')?.trim();
    if (!password) return false;
    const received = body.Token;
    if (typeof received !== 'string') return false;
    const expected = this.buildToken(body, password);
    return expected === received;
  }

  /**
   * Формирование токена для EACQ: корневые поля + Password, сортировка по ключу,
   * конкатенация значений, SHA-256 в hex.
   */
  private buildToken(params: Record<string, unknown>, password: string): string {
    const pairs: Array<{ key: string; value: string }> = [];
    for (const [key, value] of Object.entries(params)) {
      if (key === 'Token' || value === undefined || value === null) continue;
      pairs.push({ key, value: String(value) });
    }
    pairs.push({ key: 'Password', value: password });
    pairs.sort((a, b) => a.key.localeCompare(b.key));
    const concat = pairs.map((p) => p.value).join('');
    return createHash('sha256').update(concat, 'utf8').digest('hex');
  }

  async initPayment(params: TbankEacqInitParams): Promise<{
    paymentId: string;
    paymentUrl: string;
    status?: string;
  }> {
    const terminalKey = this.configService.get<string>('TBANK_EACQ_TERMINAL_KEY');
    const password = this.configService.get<string>('TBANK_EACQ_PASSWORD');
    if (!terminalKey?.trim() || !password?.trim()) {
      throw new BadRequestException(
        'TBANK_EACQ_TERMINAL_KEY и TBANK_EACQ_PASSWORD должны быть заданы в .env',
      );
    }

    const orderId = params.orderId.slice(0, 36);
    const body: Record<string, unknown> = {
      TerminalKey: terminalKey.trim(),
      Amount: params.amount,
      OrderId: orderId,
      Description: params.description.slice(0, 140),
    };
    if (params.successUrl?.trim()) body.SuccessURL = params.successUrl.trim();
    if (params.failUrl?.trim()) body.FailURL = params.failUrl.trim();
    if (params.notificationUrl?.trim())
      body.NotificationURL = params.notificationUrl.trim();

    body.Token = this.buildToken(body, password.trim());

    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}${EACQ_INIT_PATH}`;
    this.logger.log(
      `TbankEacq initPayment: POST ${url} orderId=${orderId} amount=${params.amount}`,
    );

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let data: TbankEacqInitResponse;
    try {
      data = JSON.parse(text) as TbankEacqInitResponse;
    } catch {
      throw new BadRequestException(
        `T-Bank EACQ: неверный ответ (${response.status}). ${text.slice(0, 200)}`,
      );
    }

    if (!data.Success) {
      this.logger.warn(
        `TbankEacq initPayment error: ${data.ErrorCode} ${data.Message}`,
      );
      throw new BadRequestException(
        data.Message ?? `T-Bank EACQ: ошибка ${data.ErrorCode ?? response.status}`,
      );
    }

    if (!data.PaymentId || !data.PaymentURL) {
      throw new BadRequestException(
        'T-Bank EACQ: в ответе нет PaymentId или PaymentURL',
      );
    }

    this.logger.log(
      `TbankEacq initPayment success paymentId=${data.PaymentId}`,
    );

    return {
      paymentId: String(data.PaymentId),
      paymentUrl: data.PaymentURL,
      status: data.Status,
    };
  }

  /** Получить статус заказа по OrderId (v2/GetOrderState) */
  async getOrderState(orderId: string): Promise<{
    success: boolean;
    orderId?: string;
    payments?: Array<{ paymentId?: string; status?: string; amount?: number }>;
    errorCode?: string;
    message?: string;
  }> {
    const terminalKey = this.configService.get<string>(
      'TBANK_EACQ_TERMINAL_KEY',
    );
    if (!terminalKey?.trim()) {
      throw new BadRequestException(
        'TBANK_EACQ_TERMINAL_KEY должен быть задан в .env',
      );
    }
    const body: Record<string, unknown> = {
      TerminalKey: terminalKey.trim(),
      OrderId: orderId.slice(0, 36),
    };

    const data = await this.eacqPost<TbankEacqGetOrderStateResponse>(
      EACQ_GET_ORDER_STATE_PATH,
      body,
    );

    if (!data.Success) {
      this.logger.warn(
        `TbankEacq getOrderState error: ${data.ErrorCode} ${data.Message}`,
      );
      return {
        success: false,
        errorCode: data.ErrorCode,
        message: data.Message,
      };
    }

    return {
      success: true,
      orderId: data.OrderId,
      payments: (data.Payments ?? []).map((p) => ({
        paymentId: p.PaymentId,
        status: p.Status,
        amount: p.Amount,
      })),
    };
  }

  /** Получить статус платежа по PaymentId (v2/GetState) */
  async getPaymentState(paymentId: string, ip?: string): Promise<{
    success: boolean;
    status?: string;
    orderId?: string;
    paymentId?: string;
    amount?: number;
    errorCode?: string;
    message?: string;
  }> {
    const terminalKey = this.configService.get<string>(
      'TBANK_EACQ_TERMINAL_KEY',
    );
    if (!terminalKey?.trim()) {
      throw new BadRequestException(
        'TBANK_EACQ_TERMINAL_KEY должен быть задан в .env',
      );
    }
    const body: Record<string, unknown> = {
      TerminalKey: terminalKey.trim(),
      PaymentId: paymentId,
    };
    if (ip?.trim()) body.IP = ip.trim();

    const data = await this.eacqPost<TbankEacqGetStateResponse>(
      EACQ_GET_STATE_PATH,
      body,
    );

    if (!data.Success) {
      this.logger.warn(
        `TbankEacq getPaymentState error: ${data.ErrorCode} ${data.Message}`,
      );
      return {
        success: false,
        errorCode: data.ErrorCode,
        message: data.Message,
      };
    }

    return {
      success: true,
      status: data.Status,
      orderId: data.OrderId,
      paymentId: data.PaymentId,
      amount: data.Amount,
    };
  }
}
