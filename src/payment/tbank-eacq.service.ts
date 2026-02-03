import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

const EACQ_INIT_PATH = '/v2/Init';
const EACQ_BASE_PROD = 'https://securepay.tinkoff.ru';
const EACQ_BASE_TEST = 'https://rest-api-test.tinkoff.ru';

export interface TbankEacqInitParams {
  orderId: string;
  amount: number;
  description: string;
  successUrl: string;
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

@Injectable()
export class TbankEacqService {
  private readonly logger = new Logger(TbankEacqService.name);

  constructor(private readonly configService: ConfigService) {}

  private getBaseUrl(): string {
    const useTest = this.configService.get<string>('TBANK_EACQ_USE_TEST');
    return useTest === 'true' ? EACQ_BASE_TEST : EACQ_BASE_PROD;
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
      SuccessURL: params.successUrl,
    };
    if (params.failUrl) body.FailURL = params.failUrl;
    if (params.notificationUrl) body.NotificationURL = params.notificationUrl;

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
}
