import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const TBANK_INVOICE_SEND_PATH = '/api/v1/invoice/send';
const TBANK_INVOICE_INFO_PATH = '/api/v1/openapi/invoice';
const TBANK_BASE_PROD = 'https://business.tbank.ru/openapi';
const TBANK_BASE_SANDBOX = 'https://business.tbank.ru/openapi/sandbox';

const VAT_VALUES = ['None', '0', '5', '7', '10', '18', '20', '22'] as const;

export interface TbankInvoicePayer {
  name: string;
  inn: string;
  kpp: string;
}

export interface TbankInvoiceItem {
  name: string;
  price: number;
  unit: string;
  vat: string;
  amount: number;
}

export interface TbankInvoiceContact {
  email: string;
}

export interface TbankInvoiceSendRequest {
  invoiceNumber: string;
  dueDate: string;
  invoiceDate: string;
  accountNumber: string;
  payer: TbankInvoicePayer;
  items: TbankInvoiceItem[];
  contacts: TbankInvoiceContact[];
  contactPhone?: string;
  comment?: string;
  customPaymentPurpose?: string;
}

export interface TbankInvoiceSendResponse {
  pdfUrl: string;
  invoiceId: string;
  incomingInvoiceUrl?: string;
}

@Injectable()
export class TbankInvoiceService {
  private readonly logger = new Logger(TbankInvoiceService.name);

  constructor(private readonly configService: ConfigService) {}

  private getBaseUrl(): string {
    const useSandbox = this.configService.get<string>('TBANK_SBP_USE_SANDBOX');
    return useSandbox === 'true' ? TBANK_BASE_SANDBOX : TBANK_BASE_PROD;
  }

  async sendInvoice(
    body: TbankInvoiceSendRequest,
  ): Promise<TbankInvoiceSendResponse> {
    const token = this.configService.get<string>('TBANK_API_KEY');
    if (!token?.trim()) {
      throw new BadRequestException('TBANK_API_KEY is not configured');
    }

    if (!/^\d{1,15}$/.test(body.invoiceNumber)) {
      throw new BadRequestException('invoiceNumber must be 1–15 digits');
    }
    if (!/^(\d{20}|\d{22})$/.test(body.accountNumber)) {
      throw new BadRequestException('accountNumber must be 20 or 22 digits');
    }
    if (!/^(\d{12}|\d{10})$/.test(body.payer.inn)) {
      throw new BadRequestException('payer.inn must be 10 or 12 digits');
    }
    if (!/^\d{9}$/.test(body.payer.kpp)) {
      throw new BadRequestException('payer.kpp must be 9 digits');
    }
    if (body.items.length === 0 || body.items.length > 100) {
      throw new BadRequestException('items: 1–100 elements');
    }
    for (const item of body.items) {
      if (!VAT_VALUES.includes(item.vat as (typeof VAT_VALUES)[number])) {
        throw new BadRequestException(
          `item.vat must be one of: ${VAT_VALUES.join(', ')}`,
        );
      }
    }
    if (body.contacts.length === 0 || body.contacts.length > 10) {
      throw new BadRequestException('contacts: 1–10 elements');
    }
    if (body.contactPhone && !/^(\+7)([0-9]){10}$/.test(body.contactPhone)) {
      throw new BadRequestException('contactPhone must match +7XXXXXXXXXX');
    }

    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}${TBANK_INVOICE_SEND_PATH}`;
    this.logger.log(
      `TbankInvoice sendInvoice: POST ${url} invoiceNumber=${body.invoiceNumber}`,
    );

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
      this.logger.warn(`TbankInvoice API error ${response.status}: ${text}`);
      throw new BadRequestException(
        `T-Bank выставление счёта: ошибка (${response.status}). ${text.slice(0, 200)}`,
      );
    }

    let data: TbankInvoiceSendResponse;
    try {
      data = JSON.parse(text) as TbankInvoiceSendResponse;
    } catch {
      throw new BadRequestException('T-Bank: неверный ответ API');
    }

    if (!data.pdfUrl || !data.invoiceId) {
      throw new BadRequestException(
        'T-Bank: в ответе нет pdfUrl или invoiceId',
      );
    }

    this.logger.log(
      `TbankInvoice sendInvoice success invoiceId=${data.invoiceId}`,
    );
    return data;
  }

  /** Получить информацию о выставленном счёте по invoiceId */
  async getInvoiceInfo(invoiceId: string): Promise<{ status: string }> {
    const token = this.configService.get<string>('TBANK_API_KEY');
    if (!token?.trim()) {
      throw new BadRequestException('TBANK_API_KEY is not configured');
    }
    if (!invoiceId?.trim()) {
      throw new BadRequestException('invoiceId is required');
    }

    const baseUrl = this.getBaseUrl();
    const path = `${TBANK_INVOICE_INFO_PATH}/${encodeURIComponent(invoiceId)}/info`;
    const url = `${baseUrl}${path}`;
    this.logger.log(`TbankInvoice getInvoiceInfo: GET ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    const text = await response.text();
    if (!response.ok) {
      this.logger.warn(
        `TbankInvoice getInvoiceInfo error ${response.status}: ${text}`,
      );
      throw new BadRequestException(
        `T-Bank: ошибка получения информации о счёте (${response.status}). ${text.slice(0, 200)}`,
      );
    }

    let data: { status: string };
    try {
      data = JSON.parse(text) as { status: string };
    } catch {
      throw new BadRequestException('T-Bank: неверный ответ API');
    }

    return { status: data.status ?? 'UNKNOWN' };
  }
}
