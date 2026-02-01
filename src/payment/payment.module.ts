import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TbankSbpService } from './tbank-sbp.service';
import { TbankInvoiceService } from './tbank-invoice.service';

@Module({
  imports: [ConfigModule],
  providers: [TbankSbpService, TbankInvoiceService],
  exports: [TbankSbpService, TbankInvoiceService],
})
export class PaymentModule {}
