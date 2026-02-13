import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { registerCyrillicFont } from './pdf-fonts';
import type { OrderDocument as OrderDoc } from 'src/order/order.schema';
import type { OrderLine, OrderLineLearner } from 'src/order/order.schema';

const CM_PT = 72 / 2.54;
const MARGIN_LEFT = 3 * CM_PT;
const MARGIN_RIGHT = 1 * CM_PT;
const MARGIN_TOP = 2 * CM_PT;
const MARGIN_BOTTOM = 2 * CM_PT;
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

const FONT_SIZE = 10;
const LINE_HEIGHT = 14;
const BLOCK_GAP = 8;
const SECTION_GAP = 12;

function formatDate(d: Date | undefined): string {
  if (!d) return '—';
  const x = d instanceof Date ? d : new Date(d);
  if (isNaN(x.getTime())) return '—';
  const day = String(x.getDate()).padStart(2, '0');
  const month = String(x.getMonth() + 1).padStart(2, '0');
  const year = x.getFullYear();
  return `${day}.${month}.${year}`;
}

function fio(l: OrderLineLearner): string {
  const parts = [l.lastName, l.firstName, l.middleName].filter(Boolean);
  return parts.join(' ') || '—';
}

function str(val: string | undefined): string {
  return (val != null && String(val).trim()) ? String(val).trim() : '—';
}

/** Пара: слушатель и название программы по которой он обучается */
type LearnerWithProgram = { learner: OrderLineLearner; programTitle: string };

@Injectable()
export class CandidateApplicationGenerator {
  /**
   * Собрать всех слушателей из заказа с названием программы (для физлица: SELF / INDIVIDUAL).
   * Один и тот же человек в разных программах попадёт несколько раз.
   */
  private collectLearnersWithPrograms(order: OrderDoc): LearnerWithProgram[] {
    const out: LearnerWithProgram[] = [];
    const lines = (order.lines ?? []) as OrderLine[];
    for (const line of lines) {
      const programTitle =
        line.subProgramTitle?.trim()
          ? `${line.programTitle}. ${line.subProgramTitle}`
          : line.programTitle;
      for (const learner of line.learners ?? []) {
        out.push({ learner, programTitle });
      }
    }
    return out;
  }

  async generatePdf(order: OrderDoc): Promise<Buffer> {
    const pairs = this.collectLearnersWithPrograms(order);
    const toDraw = pairs.length > 0 ? pairs : [{ learner: null as OrderLineLearner | null, programTitle: '' }];

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 0 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      registerCyrillicFont(doc);
      doc.fontSize(FONT_SIZE);

      for (let i = 0; i < toDraw.length; i++) {
        if (i > 0) doc.addPage({ size: 'A4', margin: 0 });
        this.drawOneCandidateForm(doc, order, toDraw[i].learner, toDraw[i].programTitle);
      }

      doc.end();
    });
  }

  private drawOneCandidateForm(
    doc: PDFKit.PDFDocument,
    order: OrderDoc,
    learner: OrderLineLearner | null,
    programTitle: string,
  ): void {
    let y = MARGIN_TOP;

    const ensureSpace = (need: number) => {
      if (y + need > PAGE_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage({ size: 'A4', margin: 0 });
        y = MARGIN_TOP;
      }
    };

    // Шапка: Генеральному директору ООО «ЦОК «Стандарт Плюс» / Сеитвелиеву Руслану Ризаевичу
    doc.text('Генеральному директору', MARGIN_LEFT, y, { width: CONTENT_WIDTH, align: 'right' });
    y = doc.y + 2;
    doc.text('ООО «ЦОК «Стандарт Плюс»', MARGIN_LEFT, y, { width: CONTENT_WIDTH, align: 'right' });
    y = doc.y + 2;
    doc.text('Сеитвелиеву Руслану Ризаевичу', MARGIN_LEFT, y, { width: CONTENT_WIDTH, align: 'right' });
    y = doc.y + 2;
    doc.text(
      '295022, Республика Крым, г. Симферополь,\nпроспект Победы, 165/1 (3 этаж)',
      MARGIN_LEFT,
      y,
      { width: CONTENT_WIDTH, align: 'right' },
    );
    y = doc.y + BLOCK_GAP;

    // От: Фамилия, Имя, Отчество
    doc.text('От:', MARGIN_LEFT, y);
    y = doc.y + 4;
    doc.text(
      `Фамилия   ${learner ? learner.lastName : '____________________________________'}`,
      MARGIN_LEFT,
      y,
      { width: CONTENT_WIDTH },
    );
    y = doc.y + 3;
    doc.text(
      `Имя       ${learner ? learner.firstName : '____________________________________'}`,
      MARGIN_LEFT,
      y,
      { width: CONTENT_WIDTH },
    );
    y = doc.y + 3;
    doc.text(
      `Отчество  ${learner ? (learner.middleName ?? '') : '____________________________________'}`,
      MARGIN_LEFT,
      y,
      { width: CONTENT_WIDTH },
    );
    y = doc.y + SECTION_GAP;

    // Заявление
    doc.fontSize(12);
    doc.text('Заявление', MARGIN_LEFT, y, { width: CONTENT_WIDTH, align: 'center' });
    y = doc.y + 6;
    doc.fontSize(FONT_SIZE);
    const programLine = programTitle || '____________________________________________________________';
    doc.text(
      `Прошу принять меня на обучение по программе ${programLine}`,
      MARGIN_LEFT,
      y,
      { width: CONTENT_WIDTH },
    );
    y = doc.y + SECTION_GAP;

    // Анкета кандидата
    doc.fontSize(11);
    doc.text(
      'Анкета кандидата в обучающиеся (слушателя) ООО «ЦОК «Стандарт Плюс» (заполняется лично)',
      MARGIN_LEFT,
      y,
      { width: CONTENT_WIDTH },
    );
    y = doc.y + BLOCK_GAP;
    doc.fontSize(FONT_SIZE);

    const row = (num: number, label: string, value: string) => {
      ensureSpace(LINE_HEIGHT + 4);
      doc.text(`${num}`, MARGIN_LEFT, y, { width: 18 });
      doc.text(label, MARGIN_LEFT + 20, y, { width: 120 });
      doc.text(value, MARGIN_LEFT + 145, y, { width: CONTENT_WIDTH - 145 });
      y = doc.y + 4;
    };

    row(1, 'ФИО', learner ? fio(learner) : '—');
    row(2, 'Дата рождения', learner ? formatDate(learner.dateOfBirth) : '—');
    row(3, 'Место рождения', '—');
    row(4, 'Гражданство', learner ? str(learner.citizenship) : '—');
    const passportStr = learner
      ? [learner.passportSeries, learner.passportNumber, learner.passportIssuedBy, formatDate(learner.passportIssuedAt)]
          .filter(Boolean)
          .join(', ') || '—'
      : '—';
    row(5, 'Серия, № паспорта, когда и кем выдан', passportStr);
    row(6, 'Место регистрации по паспорту', learner ? str(learner.passportRegistrationAddress) : '—');
    row(7, 'Фактический адрес проживания', learner ? str(learner.residentialAddress) : '—');
    const educStr = learner
      ? [str(learner.educationQualification), formatDate(learner.educationDocumentIssuedAt)].filter((s) => s !== '—').join(', ') || '—'
      : '—';
    row(8, 'Образование (квалификация), дата выдачи документа', educStr);
    const workStr = learner ? [str(learner.workPlaceName), str(learner.position)].filter((s) => s !== '—').join(', ') || '—' : '—';
    row(9, 'Место работы, должность', workStr);
    row(10, 'Контактный телефон', learner ? str(learner.phone) : '—');
    row(11, 'E-mail', learner ? str(learner.email) : '—');
    row(12, 'СНИЛС', learner ? str(learner.snils) : '—');

    y = doc.y + SECTION_GAP;

    // С Уставом... ознакомлен. Статья 14...
    const langPhrase = order.trainingLanguage?.trim() ? order.trainingLanguage : 'русском';
    ensureSpace(80);
    doc.text(
      'С Уставом, Лицензией на осуществление образовательной деятельности, с образовательными программами и другими документами, регламентирующими организацию и осуществление образовательной деятельности, правами и обязанностями обучающихся (слушателей) ознакомлен(а).',
      MARGIN_LEFT,
      y,
      { width: CONTENT_WIDTH, align: 'justify' },
    );
    y = doc.y + 6;
    doc.text(
      `На основании статьи 14 Федерального закона об образовании от 29.12.2012 № 273-ФЗ «Об образовании в Российской Федерации» прошу организовать обучение на ${langPhrase} языке.`,
      MARGIN_LEFT,
      y,
      { width: CONTENT_WIDTH, align: 'justify' },
    );
    y = doc.y + 6;
    doc.text(
      'Вводный инструктаж проведён, с инструкцией по охране труда и пожарной безопасности учащихся при прохождении обучения ознакомлен(а).',
      MARGIN_LEFT,
      y,
      { width: CONTENT_WIDTH, align: 'justify' },
    );
    y = doc.y + 10;
    doc.text('Подпись _______________ (___________________)    Дата заполнения «___» _______________ 20___ г.', MARGIN_LEFT, y, {
      width: CONTENT_WIDTH,
    });
    y = doc.y + SECTION_GAP;

    // Согласие на обработку персональных данных (сокращённый блок)
    ensureSpace(200);
    doc.fontSize(9);
    doc.text(
      'СОГЛАСИЕ НА ОБРАБОТКУ ПЕРСОНАЛЬНЫХ ДАННЫХ\n\n' +
        'Я, ' +
        (learner ? fio(learner) : '_________________________________________') +
        ', даю свое согласие на обработку персональных данных, предоставленных при поступлении и в процессе обучения в ООО «ЦОК «Стандарт Плюс» (ИНН 9102253568), в соответствии с Федеральным законом от 27.07.2006 № 152-ФЗ. ' +
        'Настоящее согласие действует в течение всего периода обучения и хранения личного дела до 50 лет. Согласие может быть отозвано мной в письменной форме.',
      MARGIN_LEFT,
      y,
      { width: CONTENT_WIDTH, align: 'justify' },
    );
    y = doc.y + 12;
    doc.text('«___» ______________ 20___ г.    ___________________________ / ___________________________', MARGIN_LEFT, y, {
      width: CONTENT_WIDTH,
    });
    doc.fontSize(FONT_SIZE);
  }
}
