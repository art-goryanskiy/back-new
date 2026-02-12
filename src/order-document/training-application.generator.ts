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

const FONT_SIZE = 11;
const LINE_HEIGHT = 16;
const TABLE_HEADER_ROW_HEIGHT = 22;
const TABLE_DATA_ROW_HEIGHT = 30;
const CELL_PAD = 5;
const PARAGRAPH_GAP = 8;
const SECTION_GAP = 12;
const HEADER_BG = '#e8e8e8';
const PROGRAM_ROW_BG = '#f5f5f5';
const TABLE_BORDER = '#333333';

const TABLE_COL_WIDTHS = [
  28,
  180,
  100,
  95,
  CONTENT_WIDTH - 28 - 180 - 100 - 95,
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

/** Склонение названия языка для фразы «на ... языке» (предложный падеж) */
function languageForPhrase(lang: string | undefined): string {
  if (!lang?.trim()) return 'русском';
  const s = lang.trim().toLowerCase();
  const map: Record<string, string> = {
    русский: 'русском',
    английский: 'английском',
  };
  return map[s] ?? s;
}

/** Склонение «человек» для фразы «в количестве N ...» */
function personWord(count: number): string {
  const n = Math.abs(Math.floor(count));
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'человек';
  if (mod10 === 1) return 'человек';
  if (mod10 >= 2 && mod10 <= 4) return 'человека';
  return 'человек';
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
    const trainingLanguagePhrase = languageForPhrase(order.trainingLanguage);
    const headFullName = order.headFullName ?? '—';
    const headPosition = order.headPosition ?? '—';
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
        '295022, Республика Крым, г. Симферополь,\nпроспект Победы, 165/1 (3 этаж)',
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

      // Заявка на обучение и номер заявки в одну строку (заголовок слева, № справа)
      const orderNumber = order.number ?? `E-${String(order._id).slice(-6).padStart(6, '0')}`;
      doc.fontSize(18);
      doc.text(`№ ${orderNumber}`, MARGIN_LEFT, y, {
        width: CONTENT_WIDTH,
        align: 'right',
        lineBreak: false,
      });
      doc.text('Заявка на обучение', MARGIN_LEFT, y, { lineBreak: false });
      y = doc.y + SECTION_GAP;
      doc.fontSize(FONT_SIZE);

      // Абзацы с отступами (y = doc.y после каждого переноса)
      doc.text(`Предприятие (организация) ${organizationName}`, MARGIN_LEFT, y, {
        width: CONTENT_WIDTH,
        align: 'justify',
      });
      y = doc.y + PARAGRAPH_GAP;

      doc.text(
        `просит принять наших сотрудников, в количестве ${learnerCount} ${personWord(learnerCount)}, по программам профессиональной подготовки, переподготовки и повышения квалификации работников.`,
        MARGIN_LEFT,
        y,
        { width: CONTENT_WIDTH, align: 'justify' },
      );
      y = doc.y + PARAGRAPH_GAP;

      doc.text(`Сроки обучения: с ${trainingStartStr} по ${trainingEndStr}`, MARGIN_LEFT, y, {
        width: CONTENT_WIDTH,
        align: 'justify',
      });
      y = doc.y + PARAGRAPH_GAP;

      doc.text(
        '(согласовываются и заполняются представителями Учебного Центра)',
        MARGIN_LEFT,
        y,
        { width: CONTENT_WIDTH, align: 'justify' },
      );
      y = doc.y + PARAGRAPH_GAP;

      doc.text(`Форма обучения: ${trainingForm}.`, MARGIN_LEFT, y, {
        width: CONTENT_WIDTH,
        align: 'justify',
      });
      y = doc.y + PARAGRAPH_GAP;

      doc.text(
        `На основании статьи 14 Федерального закона об образовании от 29.12.2012 № 273-ФЗ прошу организовать обучение на ${trainingLanguagePhrase} языке.`,
        MARGIN_LEFT,
        y,
        { width: CONTENT_WIDTH, align: 'justify' },
      );
      y = doc.y + SECTION_GAP;

      // Список сотрудников — по центру, выделено
      doc.fontSize(14);
      doc.text('Список сотрудников:', MARGIN_LEFT, y, {
        width: CONTENT_WIDTH,
        align: 'center',
      });
      y = doc.y + 8;
      doc.fontSize(FONT_SIZE);

      const lines = (order.lines ?? []) as OrderLine[];
      let learnerIndex = 0;

      function ensurePageSpace(requiredHeight: number) {
        if (y + requiredHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
          doc.addPage({ size: 'A4', margin: 0 });
          y = MARGIN_TOP;
        }
      }

      function drawTableHeaderRow(atY: number) {
        doc.fillColor(HEADER_BG).rect(MARGIN_LEFT, atY, CONTENT_WIDTH, TABLE_HEADER_ROW_HEIGHT).fill();
        doc.rect(MARGIN_LEFT, atY, CONTENT_WIDTH, TABLE_HEADER_ROW_HEIGHT).strokeColor(TABLE_BORDER).stroke();
        doc.fillColor('black');
        let cx = MARGIN_LEFT;
        const headers = ['№', 'Ф.И.О.', 'Дата рождения', 'СНИЛС', 'Должность'];
        for (let i = 0; i < headers.length; i++) {
          if (i > 0) {
            doc.moveTo(cx, atY).lineTo(cx, atY + TABLE_HEADER_ROW_HEIGHT).strokeColor(TABLE_BORDER).stroke();
          }
          const cw = TABLE_COL_WIDTHS[i] - CELL_PAD * 2;
          const textY = atY + (TABLE_HEADER_ROW_HEIGHT - FONT_SIZE) / 2;
          doc.text(headers[i], cx + CELL_PAD, textY, {
            width: cw,
            align: 'center',
            lineBreak: false,
          });
          cx += TABLE_COL_WIDTHS[i];
        }
      }

      for (const line of lines) {
        const programTitle =
          line.subProgramTitle?.trim()
            ? `${line.programTitle}. ${line.subProgramTitle}`
            : line.programTitle;
        const hoursStr = line.hours != null ? ` (${line.hours} ч.)` : '';
        const programTitleText = programTitle + hoursStr;
        const programTitleHeight =
          doc.heightOfString(programTitleText, { width: CONTENT_WIDTH - CELL_PAD * 2 }) + CELL_PAD * 2;
        const programRowHeight = Math.max(TABLE_DATA_ROW_HEIGHT, Math.ceil(programTitleHeight));

        ensurePageSpace(programRowHeight + TABLE_HEADER_ROW_HEIGHT + TABLE_DATA_ROW_HEIGHT);

        // 1) Строка названия программы (с часами)
        doc.fillColor(PROGRAM_ROW_BG).rect(MARGIN_LEFT, y, CONTENT_WIDTH, programRowHeight).fill();
        doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, programRowHeight).strokeColor(TABLE_BORDER).stroke();
        doc.fillColor('black');
        doc.text(programTitleText, MARGIN_LEFT + CELL_PAD, y + CELL_PAD, {
          width: CONTENT_WIDTH - CELL_PAD * 2,
        });
        y += programRowHeight;

        // 2) Заголовок таблицы (центр по ячейкам)
        ensurePageSpace(TABLE_HEADER_ROW_HEIGHT);
        drawTableHeaderRow(y);
        y += TABLE_HEADER_ROW_HEIGHT;

        // 3) Строки слушателей
        for (const l of line.learners ?? []) {
          const fioStr = fio(l);
          const fioH = doc.heightOfString(fioStr, { width: TABLE_COL_WIDTHS[1] - CELL_PAD * 2 });
          const rowH = Math.max(TABLE_DATA_ROW_HEIGHT, Math.ceil(fioH) + CELL_PAD * 2);

          ensurePageSpace(rowH);

          const rowY = y;
          let colX = MARGIN_LEFT;
          doc.rect(MARGIN_LEFT, rowY, CONTENT_WIDTH, rowH).strokeColor(TABLE_BORDER).stroke();
          doc.rect(colX, rowY, TABLE_COL_WIDTHS[0], rowH).strokeColor(TABLE_BORDER).stroke();
          learnerIndex += 1;
          doc.text(String(learnerIndex), colX + CELL_PAD, rowY + (rowH - FONT_SIZE) / 2, {
            width: TABLE_COL_WIDTHS[0] - CELL_PAD * 2,
            align: 'center',
          });
          colX += TABLE_COL_WIDTHS[0];
          doc.rect(colX, rowY, TABLE_COL_WIDTHS[1], rowH).strokeColor(TABLE_BORDER).stroke();
          const fioBlockH = doc.heightOfString(fioStr, { width: TABLE_COL_WIDTHS[1] - CELL_PAD * 2 });
          const fioY = rowY + Math.max(CELL_PAD, (rowH - fioBlockH) / 2);
          doc.text(fioStr, colX + CELL_PAD, fioY, {
            width: TABLE_COL_WIDTHS[1] - CELL_PAD * 2,
            align: 'center',
          });
          colX += TABLE_COL_WIDTHS[1];
          doc.rect(colX, rowY, TABLE_COL_WIDTHS[2], rowH).strokeColor(TABLE_BORDER).stroke();
          doc.text(formatDate(l.dateOfBirth), colX + CELL_PAD, rowY + (rowH - FONT_SIZE) / 2, {
            width: TABLE_COL_WIDTHS[2] - CELL_PAD * 2,
            align: 'center',
          });
          colX += TABLE_COL_WIDTHS[2];
          doc.rect(colX, rowY, TABLE_COL_WIDTHS[3], rowH).strokeColor(TABLE_BORDER).stroke();
          doc.text((l.snils ?? '—').slice(0, 25), colX + CELL_PAD, rowY + (rowH - FONT_SIZE) / 2, {
            width: TABLE_COL_WIDTHS[3] - CELL_PAD * 2,
            align: 'center',
          });
          colX += TABLE_COL_WIDTHS[3];
          doc.rect(colX, rowY, TABLE_COL_WIDTHS[4], rowH).strokeColor(TABLE_BORDER).stroke();
          doc.text((l.position ?? '—').slice(0, 40), colX + CELL_PAD, rowY + (rowH - FONT_SIZE) / 2, {
            width: TABLE_COL_WIDTHS[4] - CELL_PAD * 2,
            align: 'center',
          });
          y += rowH;
        }
      }

      y += PARAGRAPH_GAP;
      ensurePageSpace(120);
      doc.fontSize(14);
      doc.text('Оплату гарантируем.', MARGIN_LEFT, y, { width: CONTENT_WIDTH });
      y = doc.y + 10;
      doc.fontSize(FONT_SIZE);
      doc.text(`Юридический адрес: ${legalAddress}`, MARGIN_LEFT, y, {
        width: CONTENT_WIDTH,
      });
      y = doc.y + 5;
      doc.text(`Фактический адрес: ${actualAddress}`, MARGIN_LEFT, y, {
        width: CONTENT_WIDTH,
      });
      y = doc.y + 24;
      const sigLineY = y;
      const sigLineW = 120;
      const sigLineX = MARGIN_LEFT + CONTENT_WIDTH / 2 - sigLineW / 2;
      doc.text(headPosition, MARGIN_LEFT, sigLineY, { width: sigLineX - MARGIN_LEFT });
      doc.text(headFullName, sigLineX + sigLineW + 8, sigLineY, {
        width: MARGIN_LEFT + CONTENT_WIDTH - (sigLineX + sigLineW + 8),
        align: 'right',
      });
      doc.moveTo(sigLineX, sigLineY + 14).lineTo(sigLineX + sigLineW, sigLineY + 14).strokeColor('#000').stroke();
      doc.text('МП', sigLineX + sigLineW / 2 - 8, sigLineY + 18, { width: 20, align: 'center' });
      y = sigLineY + 36;
      doc.moveTo(MARGIN_LEFT, y).lineTo(MARGIN_LEFT + CONTENT_WIDTH, y).strokeColor('#cccccc').stroke();
      y += 8;
      doc.text('Контактное лицо:', MARGIN_LEFT, y, { width: CONTENT_WIDTH });
      y = doc.y + 5;
      const contactLine = [contactPosition, contactName].filter(Boolean).join(' ') || '—';
      doc.text(contactLine, MARGIN_LEFT, y, { width: CONTENT_WIDTH });
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
