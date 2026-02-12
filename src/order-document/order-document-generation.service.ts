import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import {
  OrderDocumentKind,
  type OrderDocumentDocument,
} from './order-document.schema';
import { OrderDocumentService } from './order-document.service';
import { TrainingApplicationGenerator } from './training-application.generator';
import { ContractActGenerator } from './contract-act.generator';
import { OrderService } from 'src/order/order.service';
import { StorageService } from 'src/storage/storage.service';
import { UserService } from 'src/user/user.service';
import { EmailService } from 'src/user/services/email.service';

@Injectable()
export class OrderDocumentGenerationService {
  private readonly logger = new Logger(OrderDocumentGenerationService.name);

  constructor(
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
    private readonly orderDocumentService: OrderDocumentService,
    private readonly trainingApplicationGenerator: TrainingApplicationGenerator,
    private readonly contractActGenerator: ContractActGenerator,
    private readonly storageService: StorageService,
    private readonly userService: UserService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Сгенерировать заявку на обучение по заказу, загрузить PDF в хранилище и создать запись OrderDocument.
   * Вызывать после перевода заказа в статус PAID.
   */
  async generateAndSaveTrainingApplication(orderId: string): Promise<{
    orderDocumentId: string;
    fileUrl: string;
  } | null> {
    try {
      const order = await this.orderService.findById(orderId);
      const buffer = await this.trainingApplicationGenerator.generatePdf(order);
      const key = `order-documents/${orderId}-training-${Date.now()}.pdf`;
      const fileUrl = await this.storageService.uploadFile(
        buffer,
        key,
        'application/pdf',
        false,
      );
      const documentDate = new Date();
      const doc = await this.orderDocumentService.create(
        orderId,
        OrderDocumentKind.TRAINING_APPLICATION,
        fileUrl,
        documentDate,
      );
      this.logger.log(
        `generateAndSaveTrainingApplication: orderId=${orderId} orderDocumentId=${doc._id}`,
      );
      const userEmail =
        order.contactEmail ??
        (await this.userService.findById((order.user as { toString: () => string }).toString()))?.email;
      if (userEmail) {
        void this.emailService
          .sendOrderPaid(userEmail, order.number ?? orderId, fileUrl)
          .catch((e) => this.logger.warn('sendOrderPaid failed', e));
      }
      return {
        orderDocumentId: doc._id.toString(),
        fileUrl,
      };
    } catch (err) {
      this.logger.error(
        `generateAndSaveTrainingApplication failed for orderId=${orderId}`,
        err,
      );
      return null;
    }
  }

  async generateAndSaveContract(
    orderId: string,
    documentDate?: Date,
  ): Promise<OrderDocumentDocument | null> {
    try {
      const order = await this.orderService.findById(orderId);
      const docDate = documentDate ?? new Date();
      const buffer = await this.contractActGenerator.generateContractPdf(
        order,
        docDate,
      );
      const key = `order-documents/${orderId}-contract-${Date.now()}.pdf`;
      const fileUrl = await this.storageService.uploadFile(
        buffer,
        key,
        'application/pdf',
        false,
      );
      const doc = await this.orderDocumentService.create(
        orderId,
        OrderDocumentKind.CONTRACT,
        fileUrl,
        docDate,
      );
      this.logger.log(`generateAndSaveContract: orderId=${orderId}`);
      const userEmail =
        order.contactEmail ??
        (await this.userService.findById((order.user as { toString: () => string }).toString()))?.email;
      if (userEmail) {
        void this.emailService
          .sendOrderStatusChanged(
            userEmail,
            order.number ?? orderId,
            'По вашей заявке сформирован договор.',
            fileUrl,
          )
          .catch((e) => this.logger.warn('sendOrderStatusChanged (contract) failed', e));
      }
      return doc;
    } catch (err) {
      this.logger.error(`generateAndSaveContract failed for orderId=${orderId}`, err);
      return null;
    }
  }

  async generateAndSaveAct(
    orderId: string,
    documentDate?: Date,
  ): Promise<OrderDocumentDocument | null> {
    try {
      const order = await this.orderService.findById(orderId);
      const docDate = documentDate ?? new Date();
      const buffer = await this.contractActGenerator.generateActPdf(
        order,
        docDate,
      );
      const key = `order-documents/${orderId}-act-${Date.now()}.pdf`;
      const fileUrl = await this.storageService.uploadFile(
        buffer,
        key,
        'application/pdf',
        false,
      );
      const doc = await this.orderDocumentService.create(
        orderId,
        OrderDocumentKind.ACT,
        fileUrl,
        docDate,
      );
      this.logger.log(`generateAndSaveAct: orderId=${orderId}`);
      const userEmail =
        order.contactEmail ??
        (await this.userService.findById((order.user as { toString: () => string }).toString()))?.email;
      if (userEmail) {
        void this.emailService
          .sendOrderStatusChanged(
            userEmail,
            order.number ?? orderId,
            'По вашей заявке сформирован акт оказанных услуг.',
            fileUrl,
          )
          .catch((e) => this.logger.warn('sendOrderStatusChanged (act) failed', e));
      }
      return doc;
    } catch (err) {
      this.logger.error(`generateAndSaveAct failed for orderId=${orderId}`, err);
      return null;
    }
  }
}
