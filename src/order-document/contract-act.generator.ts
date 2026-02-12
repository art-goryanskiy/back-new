import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { OrderDocument as OrderDoc } from 'src/order/order.schema';

function formatDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

@Injectable()
export class ContractActGenerator {
  async generateContractPdf(order: OrderDoc, documentDate: Date): Promise<Buffer> {
    return this.generateSimplePdf(
      'Договор на оказание образовательных услуг',
      order,
      documentDate,
      'Настоящий договор составлен на основании заявки на обучение. Условия оказания услуг согласованы сторонами.',
    );
  }

  async generateActPdf(order: OrderDoc, documentDate: Date): Promise<Buffer> {
    return this.generateSimplePdf(
      'Акт оказанных услуг',
      order,
      documentDate,
      'Настоящий акт составлен о том, что образовательные услуги по заявке на обучение оказаны в полном объёме.',
    );
  }

  private async generateSimplePdf(
    title: string,
    order: OrderDoc,
    documentDate: Date,
    bodyText: string,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const orderNumber = order.number ?? order._id?.toString() ?? '—';
      doc.fontSize(14).text(title, { align: 'center' });
      doc.moveDown(2);
      doc.fontSize(11).text(`Заявка № ${orderNumber}`, 50, doc.y);
      doc.moveDown(1);
      doc.text(`Дата документа: ${formatDate(documentDate)}`, 50, doc.y);
      doc.moveDown(2);
      doc.text(bodyText, 50, doc.y, { width: 495 });
      doc.moveDown(2);
      doc.fontSize(10).text(`Сумма заказа: ${Number(order.totalAmount ?? 0).toFixed(2)} ₽`, 50, doc.y);
      doc.end();
    });
  }
}
