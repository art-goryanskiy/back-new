import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

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

  async sendVerifyEmail(to: string, verifyUrl: string): Promise<void> {
    const from =
      this.configService.get<string>('SMTP_FROM') ?? 'no-reply@example.com';

    await this.transporter.sendMail({
      from,
      to,
      subject: 'Подтверждение регистрации',
      text: `Подтвердите email: ${verifyUrl}`,
      html: `<p>Подтвердите email:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
    });
  }
}
