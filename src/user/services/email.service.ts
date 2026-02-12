import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';
import { EMAIL_HTML_TEMPLATE } from '../email/email-html.template';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    const hostRaw = this.configService.get<string>('SMTP_HOST');
    const host = typeof hostRaw === 'string' ? hostRaw.trim() : '';
    if (!host) {
      throw new Error('SMTP_HOST is required');
    }

    const portStr = this.configService.get<string>('SMTP_PORT');
    const port = portStr ? Number(portStr) : 587;
    if (!Number.isFinite(port)) {
      throw new Error('SMTP_PORT must be a number');
    }

    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const secure = port === 465;
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,

      logger: !isProd,
      debug: !isProd,
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 20000,

      tls: { servername: host },
    });
  }

  private getAppName(): string {
    const v = this.configService.get<string>('APP_NAME');
    return typeof v === 'string' && v.trim()
      ? v.trim()
      : 'Учебный центр Стандарт +';
  }

  private getSupportEmail(): string {
    const v = this.configService.get<string>('SUPPORT_EMAIL');
    if (typeof v === 'string' && v.trim()) return v.trim();

    const from = this.configService.get<string>('SMTP_FROM');
    if (typeof from === 'string' && from.trim()) return from.trim();

    const user = this.configService.get<string>('SMTP_USER');
    if (typeof user === 'string' && user.trim()) return user.trim();

    return 'support@example.com';
  }

  private getExplicitLogoUrl(): string | null {
    const direct =
      this.configService.get<string>('EMAIL_LOGO_URL') ??
      this.configService.get<string>('LOGO_URL');
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
    return null;
  }

  private getLogoUrlFromFrontUrl(): string | null {
    const frontUrl = this.configService.get<string>('FRONT_URL');
    if (typeof frontUrl !== 'string' || !frontUrl.trim()) return null;
    const base = frontUrl.trim().replace(/\/$/, '');
    return `${base}/logo-full.svg`;
  }

  private findLocalLogoPath(): string | null {
    const candidates = [
      path.resolve(process.cwd(), 'src/user/email/assets/logo-full.svg'),
      path.resolve(process.cwd(), 'dist/user/email/assets/logo-full.svg'),
    ];

    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) return p;
      } catch {
        // ignore
      }
    }

    return null;
  }

  private buildBrand(): {
    brandHtml: string;
    attachments?: Mail.Attachment[];
  } {
    const appName = this.getAppName();
    const imgStyle =
      'display:block;margin:0 auto 10px;width:180px;max-width:180px;height:auto;max-height:60px;';

    const explicitUrl = this.getExplicitLogoUrl();
    if (explicitUrl) {
      return {
        brandHtml: `<img class="brand" src="${this.escapeHtml(
          explicitUrl,
        )}" width="180" height="60" style="${imgStyle}" alt="${this.escapeHtml(appName)}" />`,
      };
    }

    const localLogoPath = this.findLocalLogoPath();
    if (localLogoPath) {
      const cid = 'logo-full';
      return {
        brandHtml: `<img class="brand" src="cid:${cid}" width="180" height="60" style="${imgStyle}" alt="${this.escapeHtml(
          appName,
        )}" />`,
        attachments: [
          {
            filename: 'logo-full.svg',
            path: localLogoPath,
            cid,
            contentType: 'image/svg+xml',
          },
        ],
      };
    }

    const frontLogoUrl = this.getLogoUrlFromFrontUrl();
    if (frontLogoUrl) {
      return {
        brandHtml: `<img class="brand" src="${this.escapeHtml(
          frontLogoUrl,
        )}" width="180" height="60" style="${imgStyle}" alt="${this.escapeHtml(appName)}" />`,
      };
    }

    return {
      brandHtml: `<div class="brand" style="text-align:center;font-weight:700;font-size:18px;letter-spacing:-0.02em;margin:0 auto 18px;">${this.escapeHtml(
        appName,
      )}</div>`,
    };
  }

  private getFromEmail(): string {
    return (
      this.configService.get<string>('SMTP_FROM') ?? 'no-reply@example.com'
    );
  }

  private getAdminEmail(): string | undefined {
    const v = this.configService.get<string>('ADMIN_EMAIL');
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  }

  private escapeHtml(input: string): string {
    return input
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  private renderTemplate(params: {
    subjectTitle: string;
    preheader: string;
    headline: string;
    sub: string;
    userEmail: string;
    buttonLabel: string;
    buttonUrl: string;
    expiresIn: string;
    fallbackLabel: string;
    code: string;
    brandHtml: string;
  }): string {
    const appName = this.getAppName();
    const supportEmail = this.getSupportEmail();
    const year = String(new Date().getFullYear());

    const replaceMap: Record<string, string> = {
      appName,
      supportEmail,
      year,
      brandHtml: params.brandHtml,

      subjectTitle: params.subjectTitle,
      preheader: params.preheader,
      headline: params.headline,
      sub: params.sub,
      userEmail: params.userEmail,
      buttonLabel: params.buttonLabel,
      buttonUrl: params.buttonUrl,
      expiresIn: params.expiresIn,
      fallbackLabel: params.fallbackLabel,
      code: params.code,
    };

    return EMAIL_HTML_TEMPLATE.replaceAll(/\{\{(\w+)\}\}/g, (_m, key: string) => {
      const v = replaceMap[key];
      if (key === 'brandHtml') return typeof v === 'string' ? v : '';
      return typeof v === 'string' ? this.escapeHtml(v) : '';
    });
  }

  async sendVerifyEmail(to: string, verifyUrl: string): Promise<void> {
    const from = this.getFromEmail();
    const appName = this.getAppName();
    const safeTo = typeof to === 'string' ? to : '';
    const brand = this.buildBrand();

    await this.transporter.sendMail({
      from,
      to,
      subject: `Подтверждение email — ${appName}`,
      text: [
        `Подтвердите адрес электронной почты для ${appName}.`,
        '',
        `Аккаунт: ${safeTo}`,
        `Ссылка: ${verifyUrl}`,
        `Срок действия: 24 часа.`,
        '',
        `Если вы не создавали аккаунт — просто проигнорируйте это письмо.`,
      ].join('\n'),
      html: this.renderTemplate({
        subjectTitle: 'Подтверждение email',
        preheader: `Подтвердите email, чтобы завершить регистрацию в ${appName}.`,
        headline: 'Подтвердите адрес электронной почты',
        sub: 'Вы почти закончили. Нажмите кнопку ниже, чтобы активировать аккаунт.',
        userEmail: safeTo,
        buttonLabel: 'Подтвердить email',
        buttonUrl: verifyUrl,
        expiresIn: '24 часа',
        fallbackLabel: 'Если кнопка не работает, откройте ссылку вручную:',
        code: verifyUrl,
        brandHtml: brand.brandHtml,
      }),
      attachments: brand.attachments,
    });
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    const from = this.getFromEmail();
    const appName = this.getAppName();
    const safeTo = typeof to === 'string' ? to : '';
    const brand = this.buildBrand();

    await this.transporter.sendMail({
      from,
      to,
      subject: `Сброс пароля — ${appName}`,
      text: [
        `Запрошен сброс пароля для ${appName}.`,
        '',
        `Аккаунт: ${safeTo}`,
        `Ссылка: ${resetUrl}`,
        `Срок действия: 1 час.`,
        '',
        `Если вы не запрашивали сброс пароля — проигнорируйте это письмо.`,
      ].join('\n'),
      html: this.renderTemplate({
        subjectTitle: 'Сброс пароля',
        preheader: `Ссылка для сброса пароля в ${appName}.`,
        headline: 'Сброс пароля',
        sub: 'Нажмите кнопку ниже, чтобы установить новый пароль.',
        userEmail: safeTo,
        buttonLabel: 'Сбросить пароль',
        buttonUrl: resetUrl,
        expiresIn: '1 час',
        fallbackLabel: 'Если кнопка не работает, откройте ссылку вручную:',
        code: resetUrl,
        brandHtml: brand.brandHtml,
      }),
      attachments: brand.attachments,
    });
  }

  async sendTempPasswordEmail(to: string, tempPassword: string): Promise<void> {
    const from = this.getFromEmail();
    const appName = this.getAppName();
    const safeTo = typeof to === 'string' ? to : '';
    const frontUrl =
      this.configService.get<string>('FRONT_URL') ?? 'http://localhost:3000';
    const loginUrl = `${frontUrl}/login`;
    const brand = this.buildBrand();

    await this.transporter.sendMail({
      from,
      to,
      subject: `Временный пароль — ${appName}`,
      text: [
        `Для вашего аккаунта в ${appName} создан временный пароль.`,
        '',
        `Аккаунт: ${safeTo}`,
        `Временный пароль: ${tempPassword}`,
        `Вход: ${loginUrl}`,
        '',
        `После входа система попросит сменить пароль.`,
      ].join('\n'),
      html: this.renderTemplate({
        subjectTitle: 'Временный пароль',
        preheader: `Временный пароль для входа в ${appName}.`,
        headline: 'Временный пароль для входа',
        sub: 'Используйте временный пароль ниже для первого входа. После входа потребуется сменить пароль.',
        userEmail: safeTo,
        buttonLabel: 'Перейти к входу',
        buttonUrl: loginUrl,
        expiresIn: 'только для первого входа',
        fallbackLabel: 'Временный пароль (скопируйте вручную):',
        code: tempPassword,
        brandHtml: brand.brandHtml,
      }),
      attachments: brand.attachments,
    });
  }

  /**
   * Отправить письмо пользователю и копию на админский email (если задан ADMIN_EMAIL).
   */
  async sendOrderCreated(toUserEmail: string, orderNumber: string): Promise<void> {
    const from = this.getFromEmail();
    const appName = this.getAppName();
    const brand = this.buildBrand();
    const frontUrl =
      this.configService.get<string>('FRONT_URL') ?? 'http://localhost:3000';
    const ordersUrl = `${frontUrl}/orders`;
    const subject = `Заявка №${orderNumber} создана — ${appName}`;
    const text = [
      `Ваша заявка №${orderNumber} успешно создана.`,
      '',
      `Перейдите в раздел «Мои заявки» для оплаты: ${ordersUrl}`,
    ].join('\n');
    const html = this.renderTemplate({
      subjectTitle: `Заявка №${orderNumber} создана`,
      preheader: `Заявка №${orderNumber} создана. Оплатите заказ в личном кабинете.`,
      headline: 'Заявка создана',
      sub: `Заявка №${orderNumber}. Перейдите по ссылке ниже, чтобы перейти к оплате.`,
      userEmail: toUserEmail,
      buttonLabel: 'Мои заявки',
      buttonUrl: ordersUrl,
      expiresIn: '',
      fallbackLabel: 'Ссылка:',
      code: ordersUrl,
      brandHtml: brand.brandHtml,
    });
    const opts: Parameters<typeof this.transporter.sendMail>[0] = {
      from,
      to: toUserEmail,
      subject,
      text,
      html,
      attachments: brand.attachments,
    };
    const adminEmail = this.getAdminEmail();
    if (adminEmail) opts.bcc = adminEmail;
    await this.transporter.sendMail(opts);
  }

  /**
   * Заявка оплачена; сформирована заявка на обучение (ссылка на документ).
   */
  async sendOrderPaid(
    toUserEmail: string,
    orderNumber: string,
    documentUrl?: string,
  ): Promise<void> {
    const from = this.getFromEmail();
    const appName = this.getAppName();
    const brand = this.buildBrand();
    const frontUrl =
      this.configService.get<string>('FRONT_URL') ?? 'http://localhost:3000';
    const ordersUrl = `${frontUrl}/orders`;
    const subject = `Заявка №${orderNumber} оплачена — ${appName}`;
    const docLink = documentUrl ?? ordersUrl;
    const text = [
      `Заявка №${orderNumber} оплачена.`,
      '',
      documentUrl
        ? `Заявка на обучение (документ): ${documentUrl}`
        : `Документы доступны в разделе «Мои заявки»: ${ordersUrl}`,
    ].join('\n');
    const html = this.renderTemplate({
      subjectTitle: `Заявка №${orderNumber} оплачена`,
      preheader: `Заявка №${orderNumber} оплачена. Документ «Заявка на обучение» сформирован.`,
      headline: 'Заявка оплачена',
      sub: documentUrl
        ? 'Сформирована заявка на обучение. Ссылка на документ ниже.'
        : 'Документы доступны в личном кабинете.',
      userEmail: toUserEmail,
      buttonLabel: documentUrl ? 'Скачать заявку на обучение' : 'Мои заявки',
      buttonUrl: docLink,
      expiresIn: '',
      fallbackLabel: 'Ссылка:',
      code: docLink,
      brandHtml: brand.brandHtml,
    });
    const opts: Parameters<typeof this.transporter.sendMail>[0] = {
      from,
      to: toUserEmail,
      subject,
      text,
      html,
      attachments: brand.attachments,
    };
    const adminEmail = this.getAdminEmail();
    if (adminEmail) opts.bcc = adminEmail;
    await this.transporter.sendMail(opts);
  }

  /**
   * Уведомление о получении оплаты по заявке (без ссылки на документ).
   * Отправляется при переходе заказа в статус PAID. Заявку на обучение формирует администратор.
   */
  async sendOrderPaymentReceived(
    toUserEmail: string,
    orderNumber: string,
  ): Promise<void> {
    const from = this.getFromEmail();
    const appName = this.getAppName();
    const brand = this.buildBrand();
    const frontUrl =
      this.configService.get<string>('FRONT_URL') ?? 'http://localhost:3000';
    const ordersUrl = `${frontUrl}/orders`;
    const subject = `Оплата по заявке №${orderNumber} получена — ${appName}`;
    const text = [
      `Оплата по заявке №${orderNumber} получена. Спасибо!`,
      '',
      `Мои заявки: ${ordersUrl}`,
    ].join('\n');
    const html = this.renderTemplate({
      subjectTitle: `Оплата по заявке №${orderNumber} получена`,
      preheader: `Оплата по заявке №${orderNumber} получена.`,
      headline: 'Оплата получена',
      sub: 'Спасибо за оплату. По вопросам обращайтесь к нам.',
      userEmail: toUserEmail,
      buttonLabel: 'Мои заявки',
      buttonUrl: ordersUrl,
      expiresIn: '',
      fallbackLabel: 'Ссылка:',
      code: ordersUrl,
      brandHtml: brand.brandHtml,
    });
    const opts: Parameters<typeof this.transporter.sendMail>[0] = {
      from,
      to: toUserEmail,
      subject,
      text,
      html,
      attachments: brand.attachments,
    };
    const adminEmail = this.getAdminEmail();
    if (adminEmail) opts.bcc = adminEmail;
    await this.transporter.sendMail(opts);
  }

  /**
   * Уведомление о смене статуса заявки (например договор/акт сформированы).
   */
  async sendOrderStatusChanged(
    toUserEmail: string,
    orderNumber: string,
    message: string,
    documentUrl?: string,
  ): Promise<void> {
    const from = this.getFromEmail();
    const appName = this.getAppName();
    const brand = this.buildBrand();
    const frontUrl =
      this.configService.get<string>('FRONT_URL') ?? 'http://localhost:3000';
    const link = documentUrl ?? `${frontUrl}/orders`;
    const subject = `Заявка №${orderNumber} — ${appName}`;
    const text = [message, '', documentUrl ? `Документ: ${documentUrl}` : `Мои заявки: ${link}`].join('\n');
    const html = this.renderTemplate({
      subjectTitle: `Заявка №${orderNumber}`,
      preheader: message,
      headline: 'Обновление по заявке',
      sub: message,
      userEmail: toUserEmail,
      buttonLabel: documentUrl ? 'Скачать документ' : 'Мои заявки',
      buttonUrl: link,
      expiresIn: '',
      fallbackLabel: 'Ссылка:',
      code: link,
      brandHtml: brand.brandHtml,
    });
    const opts: Parameters<typeof this.transporter.sendMail>[0] = {
      from,
      to: toUserEmail,
      subject,
      text,
      html,
      attachments: brand.attachments,
    };
    const adminEmail = this.getAdminEmail();
    if (adminEmail) opts.bcc = adminEmail;
    await this.transporter.sendMail(opts);
  }
}
