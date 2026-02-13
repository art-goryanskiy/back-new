import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import {
  OrderDocumentKind,
  type OrderDocumentDocument,
} from './order-document.schema';
import { OrderDocumentService } from './order-document.service';
import { TrainingApplicationGenerator } from './training-application.generator';
import { CandidateApplicationGenerator } from './candidate-application.generator';
import { ContractActGenerator } from './contract-act.generator';
import { ContractDocxGenerator } from './contract-docx.generator';
import { OrderService } from 'src/order/order.service';
import { OrderCustomerType } from 'src/order/order.enums';
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
    private readonly candidateApplicationGenerator: CandidateApplicationGenerator,
    private readonly contractActGenerator: ContractActGenerator,
    private readonly contractDocxGenerator: ContractDocxGenerator,
    private readonly storageService: StorageService,
    private readonly userService: UserService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Сгенерировать заявку на обучение по заказу, загрузить PDF в хранилище и создать запись OrderDocument.
   * Для организации — «Заявка на обучение» (таблица сотрудников). Для физлица (SELF/INDIVIDUAL) — «Анкета кандидата» по одному на каждого слушателя в одном PDF.
   * В одном заказе хранится только одна такая заявка: при повторной генерации старая удаляется (файл и запись).
   */
  async generateAndSaveTrainingApplication(orderId: string): Promise<{
    orderDocumentId: string;
    fileUrl: string;
  } | null> {
    try {
      await this.orderDocumentService.deleteByOrderAndKind(
        orderId,
        OrderDocumentKind.TRAINING_APPLICATION,
      );
      const order = await this.orderService.findById(orderId);
      const isOrg = order.customerType === OrderCustomerType.ORGANIZATION;
      const buffer = isOrg
        ? await this.trainingApplicationGenerator.generatePdf(order)
        : await this.candidateApplicationGenerator.generatePdf(order);
      const orderNumber = order.number ?? orderId;
      const safeNumber = String(orderNumber).replace(/[/\\?%*:|"<>]/g, '-');
      const fileName = isOrg ? `Заявка_${safeNumber}.pdf` : `Анкеты_кандидатов_${safeNumber}.pdf`;
      const key = `order-documents/${fileName}`;
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
      await this.orderDocumentService.deleteByOrderAndKind(
        orderId,
        OrderDocumentKind.CONTRACT,
      );
      const docDate = documentDate ?? new Date();
      const contractNumber = order.number ?? orderId;
      const safeNumber = String(contractNumber).replace(/[/\\?%*:|"<>]/g, '-');
      const buffer = await this.contractDocxGenerator.generateDocx(
        order,
        docDate,
        contractNumber,
      );
      const fileName = `Договор_${safeNumber}.docx`;
      const key = `order-documents/${fileName}`;
      const mime =
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const fileUrl = await this.storageService.uploadFile(
        buffer,
        key,
        mime,
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
