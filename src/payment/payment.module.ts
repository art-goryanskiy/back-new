import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TbankInvoiceService } from './tbank-invoice.service';
import { TbankEacqService } from './tbank-eacq.service';

@Module({
  imports: [ConfigModule],
  providers: [TbankInvoiceService, TbankEacqService],
  exports: [TbankInvoiceService, TbankEacqService],
})
export class PaymentModule {}
