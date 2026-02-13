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

/** Склонение языка для фразы «на ... языке» (предложный падеж) */
function languageForPhrase(lang: string | undefined): string {
  if (!lang?.trim()) return 'русском';
  const s = lang.trim().toLowerCase();
  const map: Record<string, string> = {
    русский: 'русском',
    крымскотатарский: 'крымскотатарском',
    украинский: 'украинском',
    английский: 'английском',
  };
  return map[s] ?? s;
}

/** Слушатель, программа и часы */
type LearnerWithProgram = { learner: OrderLineLearner; programTitle: string; hours: number };

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
      const hours = line.hours ?? 0;
      for (const learner of line.learners ?? []) {
        out.push({ learner, programTitle, hours });
      }
    }
    return out;
  }

  async generatePdf(order: OrderDoc): Promise<Buffer> {
    const pairs = this.collectLearnersWithPrograms(order);
    const toDraw = pairs.length > 0 ? pairs : [{ learner: null as OrderLineLearner | null, programTitle: '', hours: 0 }];

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
        this.drawOneCandidateForm(doc, order, toDraw[i].learner, toDraw[i].programTitle, toDraw[i].hours);
      }

      doc.end();
    });
  }

  private drawOneCandidateForm(
    doc: PDFKit.PDFDocument,
    order: OrderDoc,
    learner: OrderLineLearner | null,
    programTitle: string,
    hours: number,
  ): void {
    let y = MARGIN_TOP;
    const documentDate = new Date();
    const docDateStr = formatDate(documentDate);
    const docYear = documentDate.getFullYear();

    const ensureSpace = (need: number) => {
      if (y + need > PAGE_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage({ size: 'A4', margin: 0 });
        y = MARGIN_TOP;
      }
    };

    // Шапка: Генеральному директору ... (по правому краю)
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

    // От: только значения ФИО, по правому краю с отступом
    const fromFio = learner ? fio(learner) : '—';
    doc.text(fromFio, MARGIN_LEFT, y, { width: CONTENT_WIDTH, align: 'right' });
    y = doc.y + SECTION_GAP;

    // Заявление: по программе \n повышения квалификации «...» (N ч.)
    doc.fontSize(12);
    doc.text('Заявление', MARGIN_LEFT, y, { width: CONTENT_WIDTH, align: 'center' });
    y = doc.y + 6;
    doc.fontSize(FONT_SIZE);
    doc.text('Прошу принять меня на обучение по программе', MARGIN_LEFT, y, { width: CONTENT_WIDTH });
    y = doc.y + 4;
    const programSecondLine = programTitle
      ? `повышения квалификации «${programTitle}»${hours ? ` (${hours} ч.)` : ''}`
      : '____________________________________________________________';
    doc.text(programSecondLine, MARGIN_LEFT, y, { width: CONTENT_WIDTH });
    y = doc.y + SECTION_GAP;

    // Анкета кандидата — по центру, без "(заполняется лично)"
    doc.fontSize(11);
    doc.text(
      'Анкета кандидата в обучающиеся (слушателя) ООО «ЦОК «Стандарт Плюс»',
      MARGIN_LEFT,
      y,
      { width: CONTENT_WIDTH, align: 'center' },
    );
    y = doc.y + BLOCK_GAP;
    doc.fontSize(FONT_SIZE);

    // Таблица: № | Наименование | Данные (перенос в ячейке)
    const colNoW = 22;
    const colLabelW = 140;
    const colValueW = CONTENT_WIDTH - colNoW - colLabelW - 4;
    const cellPad = 4;
    const tableLeft = MARGIN_LEFT;

    const drawTableRow = (num: number, label: string, value: string) => {
      const valueH = doc.heightOfString(value, { width: colValueW - cellPad * 2 });
      const labelH = doc.heightOfString(label, { width: colLabelW - cellPad * 2 });
      const rowH = Math.max(20, Math.ceil(valueH) + cellPad * 2, Math.ceil(labelH) + cellPad * 2);
      ensureSpace(rowH);
      const rowY = y;
      doc.rect(tableLeft, rowY, colNoW, rowH).stroke();
      doc.rect(tableLeft + colNoW, rowY, colLabelW, rowH).stroke();
      doc.rect(tableLeft + colNoW + colLabelW, rowY, colValueW, rowH).stroke();
      doc.text(String(num), tableLeft + cellPad, rowY + (rowH - FONT_SIZE) / 2, { width: colNoW - cellPad * 2 });
      doc.text(label, tableLeft + colNoW + cellPad, rowY + cellPad, { width: colLabelW - cellPad * 2 });
      doc.text(value, tableLeft + colNoW + colLabelW + cellPad, rowY + cellPad, { width: colValueW - cellPad * 2 });
      y = rowY + rowH;
    };

    drawTableRow(1, 'ФИО', learner ? fio(learner) : '—');
    drawTableRow(2, 'Дата рождения', learner ? formatDate(learner.dateOfBirth) : '—');
    drawTableRow(3, 'Место рождения', '—');
    drawTableRow(4, 'Гражданство', learner ? str(learner.citizenship) : '—');
    const passportStr = learner
      ? [learner.passportSeries, learner.passportNumber, learner.passportIssuedBy, formatDate(learner.passportIssuedAt)]
          .filter(Boolean)
          .join(', ') || '—'
      : '—';
    drawTableRow(5, 'Серия, № паспорта, когда и кем выдан', passportStr);
    drawTableRow(6, 'Место регистрации по паспорту', learner ? str(learner.passportRegistrationAddress) : '—');
    drawTableRow(7, 'Фактический адрес проживания', learner ? str(learner.residentialAddress) : '—');
    const educStr = learner
      ? [str(learner.educationQualification), formatDate(learner.educationDocumentIssuedAt)].filter((s) => s !== '—').join(', ') || '—'
      : '—';
    drawTableRow(8, 'Образование (квалификация), дата выдачи документа', educStr);
    const workStr = learner ? [str(learner.workPlaceName), str(learner.position)].filter((s) => s !== '—').join(', ') || '—' : '—';
    drawTableRow(9, 'Место работы, должность', workStr);
    drawTableRow(10, 'Контактный телефон', learner ? str(learner.phone) : '—');
    drawTableRow(11, 'E-mail', learner ? str(learner.email) : '—');
    drawTableRow(12, 'СНИЛС', learner ? str(learner.snils) : '—');

    y += SECTION_GAP;

    // С Уставом... Статья 14 с склонением языка
    const langPhrase = languageForPhrase(order.trainingLanguage);
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
    doc.text(
      `Подпись _______________ (${learner ? fio(learner) : '___________________'})    Дата заполнения «___» ${docDateStr} ${docYear} г.`,
      MARGIN_LEFT,
      y,
      { width: CONTENT_WIDTH },
    );
    y = doc.y + SECTION_GAP;

    // Согласие на обработку персональных данных — заголовок по центру, полный текст
    ensureSpace(50);
    doc.fontSize(10);
    doc.text('СОГЛАСИЕ НА ОБРАБОТКУ ПЕРСОНАЛЬНЫХ ДАННЫХ', MARGIN_LEFT, y, { width: CONTENT_WIDTH, align: 'center' });
    y = doc.y + 6;
    doc.fontSize(8);
    const consentIntro =
      'г. Симферополь\n\n' +
      'Я, ' +
      (learner ? fio(learner) : '__________________________________________________________________________________________________________') +
      '\n(фамилия, имя, отчество слушателя (обучающегося) полностью)\n' +
      `Паспорт: серия ${learner ? str(learner.passportSeries) : '________'} № ${learner ? str(learner.passportNumber) : '___________________'} выдан: ${learner ? formatDate(learner.passportIssuedAt) : '______________________________'} код подразделения: ${learner ? str(learner.passportDepartmentCode) : '____________'}\n` +
      `(дата выдачи) ${learner ? str(learner.passportIssuedBy) : '_____________________________________________________________________________________________________________'}\n` +
      `(наименование органа, выдавшего паспорт)\n\n` +
      'Проживающий(ая) по адресу: ' +
      (learner ? str(learner.passportRegistrationAddress) : '___________________________________________________________________________________') +
      '\n(адрес постоянной регистрации с указанием почтового индекса)\n' +
      'даю свое согласие на обработку добровольно предоставленных мной при поступлении, а также в процессе обучения в Общество с ограниченной ответственностью «Центр оценки квалификаций «Стандарт плюс» (ООО «ЦОК «Стандарт плюс», ИНН 9102253568) (далее – Оператор), находящийся по адресу: 925022, Республика Крым, г. Симферополь, проспект Победы 165/1 (3 этаж), своих персональных данных согласно представленному ниже перечню: фамилия, имя, отчество; дата и место рождения; сведения о документе, удостоверяющем личность (паспортные данные); гражданство; фотография; данные о номере и дате выдачи аттестата, наименовании организации, выдавшей аттестат); сведения об образовании (уровень образования, данные о серии и номере диплома, образовательной организации, выдавшей документ об образовании, специальности и присвоенной квалификации, дате выдачи диплома и др.), сведения о месте полной регистрации и фактического проживания; сведения о контактном телефоне, адрес электронной почты; сведения о месте работы и должности, реквизиты СНИЛС (страхового свидетельства обязательного пенсионного страхования), сведения об успеваемости и посещаемости учебных занятий и другие сведения, предоставленные мной в виде копий документов, для наполнения личного дела и полученные Оператором от меня и/или моих представителей при зачислении, в процессе моей образовательной деятельности, при реализации отношений в сфере образования, предусмотренных и установленных законодательством РФ, локальными актами Оператора, договорными отношениями Оператора с моими представителями, а также прочие сведения, предусмотренные действующим законодательством РФ.';
    doc.text(consentIntro, MARGIN_LEFT, y, { width: CONTENT_WIDTH, align: 'justify' });
    y = doc.y + 4;
    doc.text(
      'Также даю свое согласие на размещение перечисленных выше данных и моей фотографии, как на бумажных носителях, так и в электронных базах данных Оператора.',
      MARGIN_LEFT,
      y,
      { width: CONTENT_WIDTH, align: 'justify' },
    );
    y = doc.y + 4;
    doc.text(
      'Я даю свое согласие на использование перечисленных выше персональных данных в целях полного исполнения Оператором своих обязанностей, обязательств и компетенций, определенных Федеральным законом от 29.12.2012 № 273-ФЗ «Об образовании в Российской Федерации», а также принимаемыми в соответствии с ними другими законами и иными нормативно-правовыми актами Российской Федерации в области образования: организация приема в образовательное учреждение; учет лиц, прошедших обучение в образовательном учреждении и обеспечение учебного процесса; индивидуальный учет результатов освоения обучающимися образовательных программ, а также хранение в архивах данных об этих результатах на бумажных и/или электронных носителях; подтверждение третьим лицам сведений о факте обучения в ООО «ЦОК «Стандарт плюс», а также подача сведений в Министерство образования и науки Российской Федерации через Федеральную информационную систему «Федеральный реестр сведений о документах об образовании и (или) о квалификации, документах об обучении»; оформление документов на обучающихся в связи с несчастным случаем на территории Оператора; предотвращение угрозы жизни и здоровью обучающихся и работников Оператора, реализации мероприятий по охране труда и технике безопасности; разрешение вопросов, возникающих ввиду нанесения материального ущерба обучающимся, работникам и имуществу Оператора; проведение санэпидемиологических мероприятий.',
      MARGIN_LEFT,
      y,
      { width: CONTENT_WIDTH, align: 'justify' },
    );
    y = doc.y + 4;
    doc.text(
      'Настоящее согласие предоставляется на обработку персональных данных, под которой понимаются действия (операции) с персональными данными в рамках исполнения Федерального закона от 27.07.2006 № 152-ФЗ, как то: сбор; систематизация; накопление; хранение; уточнение (обновление, изменение); использование; распространение (в том числе передача третьим лицам – Министерство образования и науки РФ и его структурные подразделения; Министерство внутренних дел и его структурные подразделения и иные органы в соответствии с имеющимися компетенциями); получение от третьих лиц в целях решения задач, связанных с обучением в ООО «ЦОК «Стандарт плюс»; обезличивание; блокирование персональных данных, удаление, уничтожение, а также осуществление любых иных действий, предусмотренных действующим законодательством РФ.',
      MARGIN_LEFT,
      y,
      { width: CONTENT_WIDTH, align: 'justify' },
    );
    y = doc.y + 4;
    doc.text(
      'Настоящим подтверждаю факт моего информирования о том, что у Оператора обработка персональных данных осуществляется в соответствии с действующим законодательством РФ как неавтоматизированным, так и автоматизированным способом обработки. Настоящее согласие действует в течение всего периода обучения и хранения личного дела до 50 лет. Я информирован(а) о том, что настоящее согласие может быть отозвано мной в письменной форме в любое время. Настоящим признаю, что Оператор имеет право проверить достоверность представленных мною персональных данных. Я подтверждаю, что, давая такое согласие, я действую по собственной воле и в своих интересах.',
      MARGIN_LEFT,
      y,
      { width: CONTENT_WIDTH, align: 'justify' },
    );
    y = doc.y + 10;
    doc.text(
      `«___» ______________ ${docYear} г.       ___________________________ / ${learner ? fio(learner) : '___________________________'}`,
      MARGIN_LEFT,
      y,
      { width: CONTENT_WIDTH },
    );
    doc.fontSize(FONT_SIZE);
  }
}
