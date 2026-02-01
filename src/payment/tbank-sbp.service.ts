import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const TBANK_SBP_ONETIME_PATH = '/api/v1/b2b/qr/onetime';
const TBANK_SBP_QR_INFO_PATH = '/api/v1/b2b/qr';
const TBANK_BASE_PROD = 'https://business.tbank.ru/openapi';
const TBANK_BASE_SANDBOX = 'https://business.tbank.ru/openapi/sandbox';

const VAT_VALUES = ['0', '5', '7', '10', '20', '22'] as const;

export interface TbankSbpOnetimeRequest {
  accountNumber: string;
  sum: number;
  purpose: string;
  ttl: number;
  vat: string;
  redirectUrl: string;
}

export interface TbankSbpOnetimeResponse {
  qrId: string;
  paymentUrl: string;
  type: string;
  status: string;
  accountNumber: string;
  vat: string;
  sum: number;
  sumVat?: number;
  dueDate: string;
  purpose: string;
  redirectUrl: string;
  image?: {
    content: string;
    mediaType: string;
  };
}

export interface CreateSbpLinkResult {
  qrId: string;
  paymentUrl: string;
  dueDate: Date;
  qrImageBase64?: string;
}

@Injectable()
export class TbankSbpService {
  private readonly logger = new Logger(TbankSbpService.name);

  constructor(private readonly configService: ConfigService) {}

  private getBaseUrl(): string {
    const useSandbox = this.configService.get<string>('TBANK_SBP_USE_SANDBOX');
    return useSandbox === 'true' ? TBANK_BASE_SANDBOX : TBANK_BASE_PROD;
  }

  async createOneTimeLink(params: {
    sum: number;
    purpose: string;
    redirectUrl: string;
    accountNumber?: string;
    ttl?: number;
    vat?: string;
  }): Promise<CreateSbpLinkResult> {
    const token = this.configService.get<string>('TBANK_API_KEY');
    if (!token?.trim()) {
      throw new BadRequestException(
        'TBANK_API_KEY is not configured. Add it to .env',
      );
    }

    const accountNumber =
      params.accountNumber ??
      this.configService.get<string>('TBANK_SBP_ACCOUNT_NUMBER');
    if (!accountNumber || !/^\d{20}$|^\d{22}$/.test(accountNumber)) {
      throw new BadRequestException(
        'TBANK_SBP_ACCOUNT_NUMBER must be 20 or 22 digits',
      );
    }

    const vat = params.vat ?? this.configService.get<string>('TBANK_SBP_VAT') ?? '22';
    if (!VAT_VALUES.includes(vat as (typeof VAT_VALUES)[number])) {
      throw new BadRequestException(
        `vat must be one of: ${VAT_VALUES.join(', ')}`,
      );
    }

    const ttl = params.ttl ?? this.configService.get<number>('TBANK_SBP_LINK_TTL_DAYS') ?? 30;
    const body: TbankSbpOnetimeRequest = {
      accountNumber,
      sum: Number(params.sum),
      purpose: params.purpose.slice(0, 210),
      ttl: Number(ttl),
      vat,
      redirectUrl: params.redirectUrl,
    };

    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}${TBANK_SBP_ONETIME_PATH}`;
    this.logger.log(`TbankSbp createOneTimeLink: POST ${url} sum=${body.sum} purpose=${body.purpose.slice(0, 50)}...`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    if (!response.ok) {
      this.logger.warn(`TbankSbp API error ${response.status}: ${text}`);
      throw new BadRequestException(
        `T-Bank СБП: ошибка создания ссылки (${response.status}). ${text.slice(0, 200)}`,
      );
    }

    let data: TbankSbpOnetimeResponse;
    try {
      data = JSON.parse(text) as TbankSbpOnetimeResponse;
    } catch {
      throw new BadRequestException('T-Bank СБП: неверный ответ API');
    }

    if (!data.paymentUrl || !data.qrId) {
      throw new BadRequestException(
        'T-Bank СБП: в ответе нет paymentUrl или qrId',
      );
    }

    const dueDate = data.dueDate ? new Date(data.dueDate) : new Date();
    this.logger.log(`TbankSbp createOneTimeLink success qrId=${data.qrId} paymentUrl=${data.paymentUrl.slice(0, 50)}...`);

    return {
      qrId: data.qrId,
      paymentUrl: data.paymentUrl,
      dueDate,
      qrImageBase64: data.image?.content,
    };
  }

  /** Получить информацию о ссылке СБП по qrId */
  async getQrLinkInfo(
    qrId: string,
  ): Promise<{
    qrId: string;
    paymentUrl: string;
    type: string;
    status: string;
    accountNumber: string;
  }> {
    const token = this.configService.get<string>('TBANK_API_KEY');
    if (!token?.trim()) {
      throw new BadRequestException('TBANK_API_KEY is not configured');
    }
    if (!qrId?.trim()) {
      throw new BadRequestException('qrId is required');
    }

    const baseUrl = this.getBaseUrl();
    const path = `${TBANK_SBP_QR_INFO_PATH}/${encodeURIComponent(qrId)}/info`;
    const url = `${baseUrl}${path}`;
    this.logger.log(`TbankSbp getQrLinkInfo: GET ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    const text = await response.text();
    if (!response.ok) {
      this.logger.warn(`TbankSbp getQrLinkInfo error ${response.status}: ${text}`);
      throw new BadRequestException(
        `T-Bank СБП: ошибка получения информации о ссылке (${response.status}). ${text.slice(0, 200)}`,
      );
    }

    let data: { qrId?: string; paymentUrl?: string; type?: string; status?: string; accountNumber?: string };
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      throw new BadRequestException('T-Bank СБП: неверный ответ API');
    }

    return {
      qrId: data.qrId ?? qrId,
      paymentUrl: data.paymentUrl ?? '',
      type: data.type ?? 'Onetime',
      status: data.status ?? 'UNKNOWN',
      accountNumber: data.accountNumber ?? '',
    };
  }
}
