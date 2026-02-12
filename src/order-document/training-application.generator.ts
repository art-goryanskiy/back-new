import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { registerCyrillicFont } from './pdf-fonts';
import type { OrderDocument as OrderDoc } from 'src/order/order.schema';
import type { OrderLine, OrderLineLearner } from 'src/order/order.schema';
import { OrderCustomerType } from 'src/order/order.enums';
import { OrganizationService } from 'src/organization/organization.service';
import { UserService } from 'src/user/user.service';

const CM_PT = 72 / 2.54;
const MARGIN_LEFT = 3 * CM_PT;
const MARGIN_RIGHT = 1 * CM_PT;
const MARGIN_TOP = 2 * CM_PT;
const MARGIN_BOTTOM = 2 * CM_PT;
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

const FONT_SIZE = 14;
const LINE_HEIGHT = 20;
const TABLE_HEADER_ROW_HEIGHT = 26;
const TABLE_DATA_ROW_HEIGHT = 36;
const CELL_PAD = 6;
const PARAGRAPH_GAP = 10;
const SECTION_GAP = 14;
const HEADER_BG = '#e8e8e8';
const PROGRAM_ROW_BG = '#f5f5f5';
const TABLE_BORDER = '#333333';

const TABLE_COL_WIDTHS = [
  35,
  140,
  90,
  110,
  CONTENT_WIDTH - 35 - 140 - 90 - 110,
]; // №, ФИО, Дата рождения, СНИЛС, Должность

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

  async generatePdf(order: OrderDoc): Promise<Buffer> {
    const learnerCount = (order.lines ?? []).reduce(
      (sum, line) => sum + (line.learners?.length ?? 0),
      0,
    );

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
    const headFullName = order.headFullName ?? '—';
    const contactName = order.contactPersonName ?? '—';
    const contactPosition = order.contactPersonPosition ?? '—';
    const contactPhone = order.contactPhone ?? '—';
    const contactEmail = order.contactEmail ?? '—';

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 0,
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      registerCyrillicFont(doc);
      doc.fontSize(FONT_SIZE);

      let y = MARGIN_TOP;

      // Шапка справа (y синхронизируем с doc.y после переноса строк)
      doc.text('Генеральному директору', MARGIN_LEFT, y, {
        width: CONTENT_WIDTH,
        align: 'right',
      });
      y = doc.y + 4;
      doc.text('ООО «ЦОК «Стандарт Плюс»', MARGIN_LEFT, y, {
        width: CONTENT_WIDTH,
        align: 'right',
      });
      y = doc.y + 4;
      doc.text(
        '295022, Республика Крым, г. Симферополь, проспект Победы, 165/1 (3 этаж)',
        MARGIN_LEFT,
        y,
        { width: CONTENT_WIDTH, align: 'right' },
      );
      y = doc.y + 4;
      doc.text('cokstandartplus@mail.ru', MARGIN_LEFT, y, {
        width: CONTENT_WIDTH,
        align: 'right',
      });
      y = doc.y + 12;
      doc.moveTo(MARGIN_LEFT, y).lineTo(MARGIN_LEFT + CONTENT_WIDTH, y).strokeColor('#cccccc').stroke();
      y += 14;

      // Заявка на обучение — по центру, выделено (крупнее)
      doc.fontSize(18);
      doc.text('Заявка на обучение', MARGIN_LEFT, y, {
        width: CONTENT_WIDTH,
        align: 'center',
      });
      y = doc.y + SECTION_GAP;
      doc.fontSize(FONT_SIZE);

      // Абзацы с отступами (y = doc.y после каждого переноса)
      doc.text(`Предприятие (организация) ${organizationName}`, MARGIN_LEFT, y, {
        width: CONTENT_WIDTH,
      });
      y = doc.y + PARAGRAPH_GAP;

      doc.text(
        `просит принять наших сотрудников, в количестве ${learnerCount} человек, по программам профессиональной подготовки, переподготовки и повышения квалификации работников.`,
        MARGIN_LEFT,
        y,
        { width: CONTENT_WIDTH },
      );
      y = doc.y + PARAGRAPH_GAP;

      doc.text(`Сроки обучения: с ${trainingStartStr} по ${trainingEndStr}`, MARGIN_LEFT, y, {
        width: CONTENT_WIDTH,
      });
      y = doc.y + PARAGRAPH_GAP;

      doc.text(
        '(согласовываются и заполняются представителями Учебного Центра)',
        MARGIN_LEFT,
        y,
        { width: CONTENT_WIDTH },
      );
      y = doc.y + PARAGRAPH_GAP;

      doc.text(`Форма обучения: ${trainingForm}.`, MARGIN_LEFT, y, {
        width: CONTENT_WIDTH,
      });
      y = doc.y + PARAGRAPH_GAP;

      doc.text(
        `На основании статьи 14 Федерального закона об образовании от 29.12.2012 № 273-ФЗ прошу организовать обучение на: ${trainingLanguage} языке.`,
        MARGIN_LEFT,
        y,
        { width: CONTENT_WIDTH },
      );
      y = doc.y + SECTION_GAP;

      // Список сотрудников — по центру, выделено
      doc.fontSize(16);
      doc.text('Список сотрудников:', MARGIN_LEFT, y, {
        width: CONTENT_WIDTH,
        align: 'center',
      });
      y = doc.y + 10;
      doc.fontSize(FONT_SIZE);

      // Таблица: заголовок с заливкой
      const tableTop = y;
      doc.fillColor(HEADER_BG).rect(MARGIN_LEFT, tableTop, CONTENT_WIDTH, TABLE_HEADER_ROW_HEIGHT).fill();
      doc.rect(MARGIN_LEFT, tableTop, CONTENT_WIDTH, TABLE_HEADER_ROW_HEIGHT).strokeColor(TABLE_BORDER).stroke();
      doc.fillColor('black');
      let colX = MARGIN_LEFT;
      const headers = ['№', 'Ф.И.О.', 'Дата рождения', 'СНИЛС', 'Должность'];
      for (let i = 0; i < headers.length; i++) {
        if (i > 0) {
          doc
            .moveTo(colX, tableTop)
            .lineTo(colX, tableTop + TABLE_HEADER_ROW_HEIGHT)
            .strokeColor(TABLE_BORDER)
            .stroke();
        }
        doc.text(headers[i], colX + CELL_PAD, tableTop + (TABLE_HEADER_ROW_HEIGHT - FONT_SIZE) / 2, {
          width: TABLE_COL_WIDTHS[i] - CELL_PAD * 2,
        });
        colX += TABLE_COL_WIDTHS[i];
      }
      y = tableTop + TABLE_HEADER_ROW_HEIGHT;

      // По программам: строка с названием программы (высота по содержимому), затем слушатели
      const lines = (order.lines ?? []) as OrderLine[];
      let learnerIndex = 0;
      for (const line of lines) {
        const programTitle =
          line.subProgramTitle?.trim() ?
            `${line.programTitle}. ${line.subProgramTitle}`
          : line.programTitle;
        const programTitleHeight =
          doc.heightOfString(programTitle, {
            width: CONTENT_WIDTH - CELL_PAD * 2,
          }) +
          CELL_PAD * 2;
        const programRowHeight = Math.max(TABLE_DATA_ROW_HEIGHT, Math.ceil(programTitleHeight));

        if (y > PAGE_HEIGHT - MARGIN_BOTTOM - programRowHeight - TABLE_DATA_ROW_HEIGHT) {
          doc.addPage();
          y = MARGIN_TOP;
        }
        doc.fillColor(PROGRAM_ROW_BG).rect(MARGIN_LEFT, y, CONTENT_WIDTH, programRowHeight).fill();
        doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, programRowHeight).strokeColor(TABLE_BORDER).stroke();
        doc.fillColor('black');
        doc.text(programTitle, MARGIN_LEFT + CELL_PAD, y + CELL_PAD, {
          width: CONTENT_WIDTH - CELL_PAD * 2,
        });
        y += programRowHeight;

        for (const l of line.learners ?? []) {
          if (y > PAGE_HEIGHT - MARGIN_BOTTOM - TABLE_DATA_ROW_HEIGHT) {
            doc.addPage();
            y = MARGIN_TOP;
          }
          const rowY = y;
          colX = MARGIN_LEFT;
          const cellY = rowY + (TABLE_DATA_ROW_HEIGHT - FONT_SIZE) / 2;
          doc
            .rect(MARGIN_LEFT, rowY, CONTENT_WIDTH, TABLE_DATA_ROW_HEIGHT)
            .strokeColor(TABLE_BORDER)
            .stroke();
          doc.rect(colX, rowY, TABLE_COL_WIDTHS[0], TABLE_DATA_ROW_HEIGHT).strokeColor(TABLE_BORDER).stroke();
          learnerIndex += 1;
          doc.text(String(learnerIndex), colX + CELL_PAD, cellY, {
            width: TABLE_COL_WIDTHS[0] - CELL_PAD * 2,
          });
          colX += TABLE_COL_WIDTHS[0];
          doc.rect(colX, rowY, TABLE_COL_WIDTHS[1], TABLE_DATA_ROW_HEIGHT).strokeColor(TABLE_BORDER).stroke();
          doc.text(fio(l), colX + CELL_PAD, cellY, { width: TABLE_COL_WIDTHS[1] - CELL_PAD * 2 });
          colX += TABLE_COL_WIDTHS[1];
          doc.rect(colX, rowY, TABLE_COL_WIDTHS[2], TABLE_DATA_ROW_HEIGHT).strokeColor(TABLE_BORDER).stroke();
          doc.text(formatDate(l.dateOfBirth), colX + CELL_PAD, cellY, {
            width: TABLE_COL_WIDTHS[2] - CELL_PAD * 2,
          });
          colX += TABLE_COL_WIDTHS[2];
          doc.rect(colX, rowY, TABLE_COL_WIDTHS[3], TABLE_DATA_ROW_HEIGHT).strokeColor(TABLE_BORDER).stroke();
          doc.text((l.snils ?? '—').slice(0, 25), colX + CELL_PAD, cellY, {
            width: TABLE_COL_WIDTHS[3] - CELL_PAD * 2,
          });
          colX += TABLE_COL_WIDTHS[3];
          doc.rect(colX, rowY, TABLE_COL_WIDTHS[4], TABLE_DATA_ROW_HEIGHT).strokeColor(TABLE_BORDER).stroke();
          doc.text((l.position ?? '—').slice(0, 35), colX + CELL_PAD, cellY, {
            width: TABLE_COL_WIDTHS[4] - CELL_PAD * 2,
          });
          y += TABLE_DATA_ROW_HEIGHT;
        }
      }

      y += PARAGRAPH_GAP;
      doc.fontSize(16);
      doc.text('Оплату гарантируем.', MARGIN_LEFT, y, { width: CONTENT_WIDTH });
      y = doc.y + 12;
      doc.fontSize(FONT_SIZE);
      doc.text(`Юридический адрес: ${legalAddress}`, MARGIN_LEFT, y, {
        width: CONTENT_WIDTH,
      });
      y = doc.y + 6;
      doc.text(`Фактический адрес: ${actualAddress}`, MARGIN_LEFT, y, {
        width: CONTENT_WIDTH,
      });
      y = doc.y + 14;
      doc.text('_____________', MARGIN_LEFT, y, { width: CONTENT_WIDTH });
      y = doc.y + 6;
      doc.text(headFullName, MARGIN_LEFT, y, { width: CONTENT_WIDTH });
      y = doc.y + 6;
      doc.text('МП', MARGIN_LEFT, y);
      y = doc.y + 14;
      doc.moveTo(MARGIN_LEFT, y).lineTo(MARGIN_LEFT + CONTENT_WIDTH, y).strokeColor('#cccccc').stroke();
      y += 10;
      doc.text('Контактное лицо:', MARGIN_LEFT, y, { width: CONTENT_WIDTH });
      y = doc.y + 6;
      doc.text(
        `Ф.И.О. ${contactName}    Должность ${contactPosition}`,
        MARGIN_LEFT,
        y,
        { width: CONTENT_WIDTH },
      );
      y = doc.y + 6;
      doc.text(`Телефон: ${contactPhone}`, MARGIN_LEFT, y, {
        width: CONTENT_WIDTH,
      });
      y = doc.y + 6;
      doc.text(`E-mail: ${contactEmail}`, MARGIN_LEFT, y, {
        width: CONTENT_WIDTH,
      });

      doc.end();
    });
  }
}
