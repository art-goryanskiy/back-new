import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { registerCyrillicFont } from './pdf-fonts';
import type { OrderDocument as OrderDoc } from 'src/order/order.schema';
import type { OrderLineLearner } from 'src/order/order.schema';
import { OrderCustomerType } from 'src/order/order.enums';
import { OrganizationService } from 'src/organization/organization.service';
import { UserService } from 'src/user/user.service';

const FONT_SIZE = 11;
const LINE_HEIGHT = 14;
const MARGIN = 50;
const TABLE_COL_WIDTHS = [30, 120, 80, 100, 120]; // №, ФИО, Дата рождения, СНИЛС, Должность

function formatDate(d: Date | undefined): string {
  if (!d) return '—';
  const x = d instanceof Date ? d : new Date(d);
  if (isNaN(x.getTime())) return '—';
  const day = String(x.getDate()).padStart(2, '0');
  const month = String(x.getMonth() + 1).padStart(2, '0');
  const year = x.getFullYear();
  return `${day}.${month}.${year}`;
}

function fio(learner: OrderLineLearner): string {
  const parts = [learner.lastName, learner.firstName, learner.middleName].filter(
    Boolean,
  );
  return parts.join(' ') || '—';
}

@Injectable()
export class TrainingApplicationGenerator {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly userService: UserService,
  ) {}

  /** Собрать всех слушателей по всем строкам заказа (с дублированием по программам не делаем — один общий список). */
  private getAllLearners(order: OrderDoc): OrderLineLearner[] {
    const seen = new Set<string>();
    const result: OrderLineLearner[] = [];
    for (const line of order.lines ?? []) {
      for (const l of line.learners ?? []) {
        const key = `${l.lastName}|${l.firstName}|${l.middleName}|${l.dateOfBirth ?? ''}|${l.snils ?? ''}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push(l);
        }
      }
    }
    return result;
  }

  async generatePdf(order: OrderDoc): Promise<Buffer> {
    const learners = this.getAllLearners(order);
    const learnerCount = learners.length;

    let organizationName = '—';
    let legalAddress = '—';
    let actualAddress = '—';
    if (
      order.customerType === OrderCustomerType.ORGANIZATION &&
      order.organization
    ) {
      try {
        const org = await this.organizationService.findById(
          (order.organization as { toString: () => string }).toString(),
        );
        organizationName = org?.displayName ?? org?.fullName ?? org?.shortName ?? '—';
        legalAddress = org?.legalAddress ?? '—';
        actualAddress = org?.actualAddress ?? org?.legalAddress ?? '—';
      } catch {
        // leave defaults
      }
    } else {
      const profile = await this.userService.getProfileByUserId(
        (order.user as { toString: () => string }).toString(),
      );
      if (profile) {
        const parts = [profile.lastName, profile.firstName, profile.middleName].filter(Boolean);
        organizationName = parts.length ? parts.join(' ') : 'Физическое лицо';
      }
    }

    const trainingStartStr = order.trainingStartDate
      ? formatDate(order.trainingStartDate)
      : '_______________';
    const trainingEndStr = order.trainingEndDate
      ? formatDate(order.trainingEndDate)
      : '_______________';
    const trainingForm = order.trainingForm ?? 'согласовывается';
    const trainingLanguage = order.trainingLanguage ?? 'русском';
    const headPosition = order.headPosition ?? '—';
    const headFullName = order.headFullName ?? '—';
    const contactName = order.contactPersonName ?? '—';
    const contactPosition = order.contactPersonPosition ?? '—';
    const contactPhone = order.contactPhone ?? '—';
    const contactEmail = order.contactEmail ?? '—';

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: MARGIN,
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      registerCyrillicFont(doc);

      let y = doc.y;

      doc.fontSize(10);
      doc.text('Генеральному директору', MARGIN, y);
      y += LINE_HEIGHT;
      doc.text('ООО «ЦОК «Стандарт Плюс»', MARGIN, y);
      y += LINE_HEIGHT;
      doc.text(
        'Юридический адрес: 295022, Республика Крым, г. Симферополь, проспект Победы, 165/1 (3 этаж)',
        MARGIN,
        y,
      );
      y += LINE_HEIGHT;
      doc.text('cokstandartplus@mail.ru', MARGIN, y);
      y += LINE_HEIGHT * 2;

      doc.fontSize(12);
      doc.text('Заявка на обучение', MARGIN, y);
      y += LINE_HEIGHT * 1.5;

      doc.fontSize(FONT_SIZE);
      doc.text(`Предприятие (организация) ${organizationName}`, MARGIN, y);
      y += LINE_HEIGHT;
      doc.text(
        `просит принять наших сотрудников, в количестве ${learnerCount} человек, по программам профессиональной подготовки, переподготовки и повышения квалификации работников.`,
        MARGIN,
        y,
        { width: 500 },
      );
      y += LINE_HEIGHT * 2;

      doc.text(`Сроки обучения: с ${trainingStartStr} по ${trainingEndStr}`, MARGIN, y);
      y += LINE_HEIGHT;
      doc.text(`(согласовываются и заполняются представителями Учебного Центра)`, MARGIN, y);
      y += LINE_HEIGHT;
      doc.text(`Форма обучения: ${trainingForm}.`, MARGIN, y);
      y += LINE_HEIGHT;
      doc.text(
        `На основании статьи 14 Федерального закона об образовании от 29.12.2012 № 273-ФЗ прошу организовать обучение на: ${trainingLanguage} языке.`,
        MARGIN,
        y,
        { width: 500 },
      );
      y += LINE_HEIGHT * 2;

      doc.text('Список сотрудников:', MARGIN, y);
      y += LINE_HEIGHT;

      const tableTop = y;
      doc.fontSize(9);
      doc.rect(MARGIN, tableTop, 495, LINE_HEIGHT).stroke();
      let colX = MARGIN;
      const headers = ['№', 'Ф.И.О.', 'Дата рождения', 'СНИЛС', 'Должность'];
      for (let i = 0; i < headers.length; i++) {
        doc.rect(colX, tableTop, TABLE_COL_WIDTHS[i], LINE_HEIGHT).stroke();
        doc.text(headers[i], colX + 4, tableTop + 4, { width: TABLE_COL_WIDTHS[i] - 6 });
        colX += TABLE_COL_WIDTHS[i];
      }
      y += LINE_HEIGHT;

      learners.forEach((l, idx) => {
        if (y > 700) {
          doc.addPage();
          y = MARGIN;
        }
        const rowY = y;
        colX = MARGIN;
        doc.rect(MARGIN, rowY, 495, LINE_HEIGHT).stroke();
        doc.rect(colX, rowY, TABLE_COL_WIDTHS[0], LINE_HEIGHT).stroke();
        doc.text(String(idx + 1), colX + 4, rowY + 4, { width: TABLE_COL_WIDTHS[0] - 6 });
        colX += TABLE_COL_WIDTHS[0];
        doc.rect(colX, rowY, TABLE_COL_WIDTHS[1], LINE_HEIGHT).stroke();
        doc.text(fio(l), colX + 4, rowY + 4, { width: TABLE_COL_WIDTHS[1] - 6 });
        colX += TABLE_COL_WIDTHS[1];
        doc.rect(colX, rowY, TABLE_COL_WIDTHS[2], LINE_HEIGHT).stroke();
        doc.text(formatDate(l.dateOfBirth), colX + 4, rowY + 4, { width: TABLE_COL_WIDTHS[2] - 6 });
        colX += TABLE_COL_WIDTHS[2];
        doc.rect(colX, rowY, TABLE_COL_WIDTHS[3], LINE_HEIGHT).stroke();
        doc.text((l.snils ?? '—').slice(0, 20), colX + 4, rowY + 4, { width: TABLE_COL_WIDTHS[3] - 6 });
        colX += TABLE_COL_WIDTHS[3];
        doc.rect(colX, rowY, TABLE_COL_WIDTHS[4], LINE_HEIGHT).stroke();
        doc.text((l.position ?? '—').slice(0, 25), colX + 4, rowY + 4, { width: TABLE_COL_WIDTHS[4] - 6 });
        y += LINE_HEIGHT;
      });

      y += LINE_HEIGHT;
      doc.fontSize(FONT_SIZE);
      doc.text('Оплату гарантируем.', MARGIN, y);
      y += LINE_HEIGHT;
      doc.text(`Юридический адрес: ${legalAddress}`, MARGIN, y);
      y += LINE_HEIGHT;
      doc.text(`Фактический адрес: ${actualAddress}`, MARGIN, y);
      y += LINE_HEIGHT * 2;
      doc.text(`Должность руководителя предприятия (организации): ${headPosition}`, MARGIN, y);
      y += LINE_HEIGHT;
      doc.text('Подпись _____________ Ф.И.О. ' + headFullName, MARGIN, y);
      y += LINE_HEIGHT;
      doc.text('МП', MARGIN, y);
      y += LINE_HEIGHT * 2;
      doc.text('Контактное лицо:', MARGIN, y);
      y += LINE_HEIGHT;
      doc.text(`Ф.И.О. ${contactName}    Должность ${contactPosition}`, MARGIN, y);
      y += LINE_HEIGHT;
      doc.text(`Телефон: ${contactPhone}`, MARGIN, y);
      y += LINE_HEIGHT;
      doc.text(`E-mail: ${contactEmail}`, MARGIN, y);

      doc.end();
    });
  }
}
