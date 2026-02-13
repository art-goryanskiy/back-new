import { Injectable } from '@nestjs/common';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  WidthType,
  BorderStyle,
  TableLayoutType,
  ShadingType,
  TableBorders,
  VerticalAlignTable,
  convertInchesToTwip,
} from 'docx';
import type {
  OrderDocument as OrderDoc,
  OrderLine,
  OrderLineLearner,
} from 'src/order/order.schema';
import { OrderCustomerType } from 'src/order/order.enums';
import { OrganizationService } from 'src/organization/organization.service';
import { UserService } from 'src/user/user.service';
import { EXECUTOR } from './executor.constants';
import {
  declineFullNameToGenitive,
  declinePositionToGenitive,
} from './genitive.utils';
import { rublesInWords } from './rubles-in-words';

/** Заказчик — организация (реквизиты юрлица и руководитель). */
export interface CustomerOrganization {
  type: 'organization';
  fullName: string;
  legalAddress: string;
  inn: string;
  ogrn: string;
  bankAccount?: string;
  bankName?: string;
  bik?: string;
  correspondentAccount?: string;
  headPosition: string;
  headFullName: string;
  /** В род. п. для преамбулы: «в лице Директора Горянского Артема Юрьевича». */
  headPositionGenitive?: string;
  headFullNameGenitive?: string;
}

/** Заказчик — физлицо (ФИО, адрес регистрации, паспорт). */
export interface CustomerIndividual {
  type: 'individual';
  fullName: string;
  registrationAddress: string;
  passportSeries?: string;
  passportNumber?: string;
  passportIssuedBy?: string;
  passportIssuedAt?: Date;
  phone?: string;
  email?: string;
}

export type CustomerContract = CustomerOrganization | CustomerIndividual;

const MONTH_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

function formatContractDate(d: Date): string {
  const day = d.getDate();
  const month = MONTH_GENITIVE[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year} года`;
}

/** По эталону: 11 pt основной текст, 12 pt заголовки. В half-points: 22, 24. */
const FONT_SIZE = 22;
const FONT_SIZE_HEADING = 24;
const FONT = 'Times New Roman';
/** Поля страницы как в эталоне (720 twips ≈ 1,27 см). A4: 11906 x 16838 twips. */
const PAGE_MARGIN = 720;
const A4_WIDTH = 11906;
const A4_HEIGHT = 16838;
/** Ширина области контента (для правого таб-стопа: город слева, дата справа). */
const CONTENT_WIDTH_TWIPS = A4_WIDTH - 2 * PAGE_MARGIN;
const CELL_MARGIN = convertInchesToTwip(0.08);
/** Межстрочный интервал (240 = single), отступ после абзаца (twips). */
const LINE_SPACING = 240;
const SPACING_AFTER = 160;

function run(text: string, opts: { bold?: boolean; size?: number } = {}): TextRun {
  return new TextRun({
    text,
    font: FONT,
    size: opts.size ?? FONT_SIZE,
    bold: opts.bold,
  });
}

/** Ячейка таблицы с одним абзацем (для таблицы приложения). */
function cell(text: string): TableCell {
  return new TableCell({
    margins: { top: 80, bottom: 80, left: CELL_MARGIN, right: CELL_MARGIN },
    children: [
      new Paragraph({
        children: [run(text)],
        spacing: { after: 60, line: LINE_SPACING },
      }),
    ],
  });
}

/** Ячейка заголовка таблицы приложения (жирный текст, фон, по центру по вертикали и горизонтали). */
function headerCell(text: string): TableCell {
  return new TableCell({
    shading: { fill: 'E8E8E8', type: ShadingType.CLEAR },
    margins: { top: 100, bottom: 100, left: CELL_MARGIN, right: CELL_MARGIN },
    verticalAlign: VerticalAlignTable.CENTER,
    children: [
      new Paragraph({
        children: [run(text, { bold: true })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 60, line: LINE_SPACING },
      }),
    ],
  });
}

/** Ячейка таблицы приложения с выравниванием по центру (вертикаль и горизонталь). */
function cellCentered(text: string): TableCell {
  return new TableCell({
    margins: { top: 80, bottom: 80, left: CELL_MARGIN, right: CELL_MARGIN },
    verticalAlign: VerticalAlignTable.CENTER,
    children: [
      new Paragraph({
        children: [run(text)],
        alignment: AlignmentType.CENTER,
        spacing: { after: 60, line: LINE_SPACING },
      }),
    ],
  });
}

/** Подпись: линия и ФИО (20 подчёркиваний как в образце). */
const SIGNATURE_UNDERSCORES = '____________________';

/** Одна ячейка с текстом и выравниванием (для таблицы город/дата и для строки подписанта). */
function simpleCell(
  text: string,
  alignment: (typeof AlignmentType)[keyof typeof AlignmentType],
  opts: { bold?: boolean } = {},
): TableCell {
  const lines = text.split('\n').filter((s) => s.length > 0);
  return new TableCell({
    margins: { top: CELL_MARGIN, bottom: CELL_MARGIN, left: CELL_MARGIN, right: CELL_MARGIN },
    children: lines.map(
      (line) =>
        new Paragraph({
          children: [run(line, { bold: opts.bold })],
          alignment,
          spacing: { after: 60, line: LINE_SPACING },
        }),
    ),
  });
}

/** Ячейка блока реквизитов: заголовок ИСПОЛНИТЕЛЬ/ЗАКАЗЧИК + тело (без подписанта). */
function requisitesCell(
  title: string,
  body: string,
  opts: { verticalAlign?: (typeof VerticalAlignTable)[keyof typeof VerticalAlignTable] } = {},
): TableCell {
  const lines = body.split('\n').filter((s) => s.trim().length > 0);
  const children = [
    new Paragraph({
      children: [run(title, { bold: true })],
      spacing: { after: 120, line: LINE_SPACING },
    }),
    ...lines.map(
      (line) =>
        new Paragraph({
          children: [run(line)],
          spacing: { after: 60, line: LINE_SPACING },
        }),
    ),
  ];
  return new TableCell({
    margins: {
      top: CELL_MARGIN,
      bottom: CELL_MARGIN,
      left: CELL_MARGIN,
      right: CELL_MARGIN,
    },
    verticalAlign: opts.verticalAlign,
    children,
  });
}

function formatDateShort(d: Date | undefined): string {
  if (!d) return '—';
  const x = d instanceof Date ? d : new Date(d);
  if (isNaN(x.getTime())) return '—';
  const day = String(x.getDate()).padStart(2, '0');
  const month = String(x.getMonth() + 1).padStart(2, '0');
  const year = x.getFullYear();
  return `${day}.${month}.${year}`;
}

@Injectable()
export class ContractDocxGenerator {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly userService: UserService,
  ) {}

  async generateDocx(
    order: OrderDoc,
    documentDate: Date,
    contractNumber: string,
  ): Promise<Buffer> {
    const customer = await this.resolveCustomer(order);
    const totalAmount = Number(order.totalAmount ?? 0);
    const amountWords = rublesInWords(totalAmount);
    const dateStr = formatContractDate(documentDate);
    const trainingForm = order.trainingForm?.trim() || '—';

    const children: (Paragraph | Table)[] = [];

    // Заголовок (по эталону: по центру, Times New Roman, 12 pt, жирный)
    children.push(
      new Paragraph({
        children: [run(`ДОГОВОР № ${contractNumber}`, { bold: true, size: FONT_SIZE_HEADING })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 0, line: LINE_SPACING },
      }),
      new Paragraph({
        children: [run('об образовании на обучение по дополнительным', { size: FONT_SIZE_HEADING })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 0, line: LINE_SPACING },
      }),
      new Paragraph({
        children: [run('образовательным программам', { size: FONT_SIZE_HEADING })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 300, line: LINE_SPACING },
      }),
    );

    // Город и дата: таблица с прозрачными границами, левый столбец — город (по левому краю), правый — дата (по правому краю)
    const cityDateColWidth = CONTENT_WIDTH_TWIPS / 2;
    children.push(
      new Table({
        rows: [
          new TableRow({
            children: [
              simpleCell('г. Симферополь', AlignmentType.LEFT),
              simpleCell(dateStr, AlignmentType.RIGHT),
            ],
          }),
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [cityDateColWidth, cityDateColWidth],
        layout: TableLayoutType.FIXED,
        borders: TableBorders.NONE,
      }),
      new Paragraph({ children: [], spacing: { after: 200 } }),
    );

    // Преамбула — по ширине (для организации заказчика: «в лице» в род. п. — ручные поля или автосклонение)
    const customerInPerson =
      customer.type === 'organization'
        ? (() => {
            const pos =
              customer.headPositionGenitive?.trim() ??
              declinePositionToGenitive(customer.headPosition);
            const name =
              customer.headFullNameGenitive?.trim() ??
              declineFullNameToGenitive(customer.headFullName);
            return `в лице ${pos} ${name}`;
          })()
        : '';
    const preamble =
      customer.type === 'organization'
        ? `${EXECUTOR.fullName} (далее – образовательная организация), осуществляющее образовательную деятельность на основании ${EXECUTOR.license}, именуемое в дальнейшем «Исполнитель», в лице ${EXECUTOR.directorPositionGenitive} ${EXECUTOR.directorFullNameGenitive}, действующего на основании Устава, и ${customer.fullName}, ${customerInPerson}, действующего на основании Устава, именуемый в дальнейшем «Заказчик», совместно именуемые «Стороны», заключили настоящий Договор о нижеследующем:`
        : `${EXECUTOR.fullName} (далее – образовательная организация), осуществляющее образовательную деятельность на основании ${EXECUTOR.license}, именуемое в дальнейшем «Исполнитель», в лице ${EXECUTOR.directorPositionGenitive} ${EXECUTOR.directorFullNameGenitive}, действующего на основании Устава, и ${customer.fullName}, паспорт ${customer.passportSeries ?? '—'} ${customer.passportNumber ?? '—'}, зарегистрированный по адресу: ${customer.registrationAddress}, именуемый в дальнейшем «Заказчик», совместно именуемые «Стороны», заключили настоящий Договор о нижеследующем:`;
    children.push(
      new Paragraph({
        children: [run(preamble)],
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 300, line: LINE_SPACING },
      }),
    );

    // Блоки 1–8: название блока жирным по центру, содержимое по ширине
    const blocks1to8 = this.buildBlocks1to8(amountWords, totalAmount);
    blocks1to8.forEach(({ title, content }) => {
      children.push(
        new Paragraph({
          children: [run(title, { bold: true })],
          alignment: AlignmentType.CENTER,
          spacing: { after: SPACING_AFTER, line: LINE_SPACING },
        }),
      );
      content.split('\n').filter((s) => s.length > 0).forEach((line) => {
        children.push(
          new Paragraph({
            children: [run(line)],
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: SPACING_AFTER, line: LINE_SPACING },
          }),
        );
      });
    });

    // Раздел IX — реквизиты сторон: 2 строки — в первой реквизиты, во второй подписант (чтобы не «плыли»)
    const executorRequisites =
      `${EXECUTOR.fullName}\n\nЮр. адрес: ${EXECUTOR.legalAddress}\nФакт. адрес: ${EXECUTOR.actualAddress}\nИНН / КПП: ${EXECUTOR.inn} / ${EXECUTOR.kpp}\nОГРН: ${EXECUTOR.ogrn}\nр/с ${EXECUTOR.bankAccount}\nв банке ${EXECUTOR.bankName}\nБИК ${EXECUTOR.bik}\nк/с ${EXECUTOR.correspondentAccount}\n\n${EXECUTOR.phone1}\n${EXECUTOR.phone2}\n${EXECUTOR.email1}\n${EXECUTOR.email2}`;
    const executorSignatory =
      `${EXECUTOR.directorPosition}\n${SIGNATURE_UNDERSCORES} ${EXECUTOR.directorFullName}`;

    const customerRequisites =
      customer.type === 'organization'
        ? (() => {
            const customerBank =
              customer.bankAccount && customer.bankName && customer.bik
                ? `р/с ${customer.bankAccount}\nв банке ${customer.bankName}\nк/с ${customer.correspondentAccount ?? '—'}\nБИК ${customer.bik}`
                : 'р/с —\nк/с —\nБИК —';
            return `${customer.fullName}\n\nЮр. адрес: ${customer.legalAddress}\nИНН: ${customer.inn}\nОГРН: ${customer.ogrn}\n\n${customerBank}`;
          })()
        : `${customer.fullName}\n\nАдрес регистрации: ${customer.registrationAddress}\n\nПаспорт: серия ${customer.passportSeries ?? '—'} № ${customer.passportNumber ?? '—'}\nВыдан: ${customer.passportIssuedBy ?? '—'} ${customer.passportIssuedAt ? formatDateShort(customer.passportIssuedAt) : ''}\n${customer.phone ? `Тел.: ${customer.phone}` : ''}\n${customer.email ? `E-mail: ${customer.email}` : ''}`;
    const customerSignatory =
      customer.type === 'organization'
        ? `${customer.headPosition}\n${SIGNATURE_UNDERSCORES} ${customer.headFullName}`
        : `Заказчик\n${SIGNATURE_UNDERSCORES} ${customer.fullName}`;

    const colWidth = convertInchesToTwip(3.2);
    const requisitesTable = new Table({
      rows: [
        new TableRow({
          children: [
            requisitesCell('ИСПОЛНИТЕЛЬ', executorRequisites),
            requisitesCell('ЗАКАЗЧИК', customerRequisites),
          ],
        }),
        new TableRow({
          children: [
            simpleCell(executorSignatory, AlignmentType.LEFT),
            simpleCell(customerSignatory, AlignmentType.LEFT),
          ],
        }),
      ],
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [colWidth, colWidth],
      layout: TableLayoutType.FIXED,
      borders: TableBorders.NONE,
    });

    // Блок 9: название по центру жирным, затем таблица реквизитов
    children.push(
      new Paragraph({
        children: [run('IX. Адреса и реквизиты сторон', { bold: true })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200, line: LINE_SPACING },
      }),
      requisitesTable,
      new Paragraph({ children: [], spacing: { after: 300 } }),
    );

    // Приложение № 1 — с новой страницы: две строки, по правому краю
    children.push(
      new Paragraph({
        children: [run('Приложение № 1')],
        alignment: AlignmentType.RIGHT,
        pageBreakBefore: true,
        spacing: { after: 0, line: LINE_SPACING },
      }),
      new Paragraph({
        children: [run(`к Договору № ${contractNumber} от ${dateStr}`)],
        alignment: AlignmentType.RIGHT,
        spacing: { after: 200, line: LINE_SPACING },
      }),
      new Paragraph({
        children: [run('Перечень дополнительных профессиональных программ и количества слушателей', { bold: true })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 300, line: LINE_SPACING },
      }),
    );

    const table = this.buildAppendixTable(order.lines ?? [], totalAmount, trainingForm);
    children.push(table);

    // Реквизиты под приложением — как в договоре: строка 1 — наименование, строка 2 — подписант (таблица без границ)
    const appendixExecutorRequisites = EXECUTOR.fullName;
    const appendixExecutorSignatory =
      `${EXECUTOR.directorPosition}\n${SIGNATURE_UNDERSCORES} ${EXECUTOR.directorFullName}`;
    const appendixCustomerRequisites = customer.fullName;
    const appendixCustomerSignatory =
      customer.type === 'organization'
        ? `${customer.headPosition}\n${SIGNATURE_UNDERSCORES} ${customer.headFullName}`
        : `Заказчик\n${SIGNATURE_UNDERSCORES} ${customer.fullName}`;

    const appendixColWidth = convertInchesToTwip(3.2);
    const appendixRequisitesTable = new Table({
      rows: [
        new TableRow({
          children: [
            requisitesCell('ИСПОЛНИТЕЛЬ', appendixExecutorRequisites),
            requisitesCell('ЗАКАЗЧИК', appendixCustomerRequisites),
          ],
        }),
        new TableRow({
          children: [
            simpleCell(appendixExecutorSignatory, AlignmentType.LEFT),
            simpleCell(appendixCustomerSignatory, AlignmentType.LEFT),
          ],
        }),
      ],
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [appendixColWidth, appendixColWidth],
      layout: TableLayoutType.FIXED,
      borders: TableBorders.NONE,
    });
    children.push(
      new Paragraph({ children: [], spacing: { after: 200 } }),
      appendixRequisitesTable,
    );

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              size: { width: A4_WIDTH, height: A4_HEIGHT },
              margin: {
                top: PAGE_MARGIN,
                right: PAGE_MARGIN,
                bottom: PAGE_MARGIN,
                left: PAGE_MARGIN,
                header: 0,
                footer: 0,
                gutter: 0,
              },
            },
          },
          children,
        },
      ],
    });

    return Packer.toBuffer(doc);
  }

  private buildBlocks1to8(
    amountWords: string,
    totalAmount: number,
  ): Array<{ title: string; content: string }> {
    return [
      {
        title: 'I. Предмет Договора',
        content: `1.1. Исполнитель обязуется предоставить образовательную услугу, а Заказчик обязуется оплатить образовательную услугу по предоставлению дополнительной профессиональной образовательной программы повышения квалификации согласно Приложения №1 к Договору.
1.2. После освоения обучающимися образовательных программ и успешного прохождения итоговой аттестации им выдаются документы об образовании установленного образца.`,
      },
      {
        title: 'II. Права Исполнителя, Заказчика и Обучающегося',
        content: `2.1. Исполнитель вправе:
2.1.1. Самостоятельно осуществлять образовательный процесс, устанавливать системы оценок, формы, порядок и периодичность проведения промежуточной аттестации Обучающегося.
2.1.2. Применять к Обучающемуся меры поощрения и меры дисциплинарного взыскания в соответствии с законодательством Российской Федерации, учредительными документами Исполнителя, настоящим Договором и локальными нормативными актами Исполнителя.
2.2. Заказчик вправе получать информацию от Исполнителя по вопросам организации и обеспечения надлежащего предоставления услуг, предусмотренных разделом I настоящего Договора.
2.3. Обучающемуся предоставляются академические права в соответствии с частью 1 статьи 34 Федерального закона от 29 декабря 2012 г. N 273-ФЗ «Об образовании в Российской Федерации». Обучающийся также вправе:
2.3.1. Получать информацию от Исполнителя по вопросам организации и обеспечения надлежащего предоставления услуг, предусмотренных разделом I настоящего Договора.
2.3.2. Обращаться к Исполнителю по вопросам, касающимся образовательного процесса.
2.3.3. Пользоваться в порядке, установленном локальными нормативными актами, имуществом Исполнителя, необходимым для освоения образовательной программы.
2.3.4. Принимать в порядке, установленном локальными нормативными актами, участие в социально-культурных, оздоровительных и иных мероприятиях, организованных Исполнителем.
2.3.5. Получать полную и достоверную информацию об оценке своих знаний, умений, навыков и компетенций, а также о критериях этой оценки.`,
      },
      {
        title: 'III. Обязанности Исполнителя, Заказчика и Обучающегося',
        content: `3.1. Исполнитель обязан:
3.1.1. Зачислить Обучающегося, выполнившего установленные законодательством Российской Федерации, учредительными документами, локальными нормативными актами Исполнителя условия приема, в качестве Слушателя.
3.1.2. Довести до Заказчика информацию, содержащую сведения о предоставлении платных образовательных услуг в порядке и объеме, которые предусмотрены Законом Российской Федерации «О защите прав потребителей» и Федеральным законом «Об образовании в Российской Федерации».
3.1.3. Организовать и обеспечить надлежащее предоставление образовательных услуг, предусмотренных разделом I настоящего Договора. Образовательные услуги оказываются в соответствии с федеральным государственным образовательным стандартом или федеральными государственными требованиями, учебным планом, в том числе индивидуальным, и расписанием занятий Исполнителя.
3.1.4. Обеспечить Обучающемуся предусмотренные выбранной образовательной программой условия ее освоения.
3.1.5. Сохранить место за Обучающимся в случае пропуска занятий по уважительным причинам.
3.1.6. Принимать от Обучающегося и (или) Заказчика плату за образовательные услуги.
3.1.7. Обеспечить Обучающемуся уважение человеческого достоинства, защиту от всех форм физического и психического насилия, оскорбления личности, охрану жизни и здоровья.
3.2. Заказчик обязан:
3.2.1. Своевременно вносить плату за предоставляемые Обучающемуся образовательные услуги, указанные в разделе I настоящего Договора, в размере и порядке, определенных настоящим Договором, а также предоставлять платежные документы, подтверждающие такую оплату.
3.2.2. На момент начала оказания образовательных услуг предоставить исполнителю следующие документы (на каждого обучающегося):
заявку на оказание образовательных услуг (по предоставленной форме);
копию паспорта;
копию документа о среднем специальном или высшем образовании (при их отсутствии - копию трудовой книжки);
заполненную анкету (по предоставленной форме);
согласие на обработку персональных данных (по предоставленной форме).
3.3. Обучающийся обязан соблюдать требования, установленные в статье 43 Федерального закона от 29 декабря 2012 г. N 273-ФЗ «Об образовании в Российской Федерации», в том числе:
3.3.1. Выполнять задания для подготовки к занятиям, предусмотренным учебным планом, в том числе индивидуальным.
3.3.2. Извещать Исполнителя о причинах отсутствия на занятиях.
3.3.3. Обучаться в образовательной организации по образовательной программе с соблюдением требований, установленных федеральным государственным образовательным стандартом или федеральными государственными требованиями и учебным планом, в том числе индивидуальным, Исполнителя.
3.3.4. Соблюдать требования учредительных документов, правила внутреннего распорядка и иные локальные нормативные акты Исполнителя.`,
      },
      {
        title: 'IV. Стоимость услуг, сроки и порядок их оплаты',
        content: `4.1. Полная стоимость платных образовательных услуг за весь период обучения Обучающегося составляет ${totalAmount} руб. (${amountWords}).
Увеличение стоимости образовательных услуг после заключения Договора не допускается, за исключением увеличения стоимости указанных услуг с учетом уровня инфляции, предусмотренного основными характеристиками федерального бюджета на очередной финансовый год и плановый период.
4.2. Оплата производится на условиях 100% предоплаты, которая перечисляется Заказчиком не позднее 3 рабочих дней с момента выставления Исполнителем счета на оплату, но не позднее, чем в день окончания оказания услуг, в безналичном порядке на счет, указанный в разделе IХ настоящего Договора. НДС не начисляется.
4.3 По завершении обучения персонала Заказчика, Сторонами в течение 3 (Трёх) рабочих дней подписывается двухсторонний Акт приема-передачи выполненных работ (оказанных услуг).`,
      },
      {
        title: 'V. Основания изменения и расторжения договора',
        content: `5.1. Условия, на которых заключен настоящий Договор, могут быть изменены по соглашению Сторон или в соответствии с законодательством Российской Федерации.
5.2. Настоящий Договор может быть расторгнут по соглашению Сторон.
5.3. Настоящий Договор может быть расторгнут по инициативе Исполнителя в одностороннем порядке в случаях:
установления нарушения порядка приема в образовательную организацию, повлекшего по вине Обучающегося его незаконное зачисление в эту образовательную организацию;
просрочки оплаты стоимости платных образовательных услуг;
невозможности надлежащего исполнения обязательства по оказанию платных образовательных услуг вследствие действий (бездействия) Обучающегося;
в иных случаях, предусмотренных законодательством Российской Федерации.
5.4. Настоящий Договор расторгается досрочно:
по инициативе Обучающегося, в том числе в случае перевода Обучающегося для продолжения освоения образовательной программы в другую организацию, осуществляющую образовательную деятельность;
по инициативе Исполнителя в случае применения к Обучающемуся, достигшему возраста пятнадцати лет, отчисления как меры дисциплинарного взыскания, в случае невыполнения обучающимся по профессиональной образовательной программе обязанностей по добросовестному освоению такой образовательной программы и выполнению учебного плана, а также в случае установления нарушения порядка приема в образовательную организацию, повлекшего по вине обучающегося его незаконное зачисление в образовательную организацию;
по обстоятельствам, не зависящим от воли Обучающегося и Исполнителя, в том числе в случае ликвидации Исполнителя.
5.5. Исполнитель вправе отказаться от исполнения обязательств по Договору при условии полного возмещения Заказчику убытков.
5.6. Заказчик вправе отказаться от исполнения настоящего Договора при условии оплаты Исполнителю фактически понесенных им расходов, связанных с исполнением обязательств по Договору.`,
      },
      {
        title: 'VI. Ответственность Исполнителя, Заказчика и Обучающегося',
        content: `6.1. За неисполнение или ненадлежащее исполнение своих обязательств по Договору Стороны несут ответственность, предусмотренную законодательством Российской Федерации и Договором.
6.2. При обнаружении недостатка образовательной услуги, в том числе оказания ее не в полном объеме, предусмотренном образовательными программами (частью образовательной программы), Заказчик вправе по своему выбору потребовать:
6.2.1. Безвозмездного оказания образовательной услуги;
6.2.2. Соразмерного уменьшения стоимости оказанной образовательной услуги;
6.2.3. Возмещения понесенных им расходов по устранению недостатков оказанной образовательной услуги своими силами или третьими лицами.
6.3. Заказчик вправе отказаться от исполнения Договора и потребовать полного возмещения убытков, если в тридцатидневный срок недостатки образовательной услуги не устранены Исполнителем. Заказчик также вправе отказаться от исполнения Договора, если им обнаружен существенный недостаток оказанной образовательной услуги или иные существенные отступления от условий Договора.
6.4. Если Исполнитель нарушил сроки оказания образовательной услуги (сроки начала и (или) окончания оказания образовательной услуги и (или) промежуточные сроки оказания образовательной услуги) либо если во время оказания образовательной услуги стало очевидным, что она не будет осуществлена в срок, Заказчик вправе по своему выбору:
6.4.1. Назначить Исполнителю новый срок, в течение которого Исполнитель должен приступить к оказанию образовательной услуги и (или) закончить оказание образовательной услуги;
6.4.2. Поручить оказать образовательную услугу третьим лицам за разумную цену и потребовать от Исполнителя возмещения понесенных расходов;
6.4.3. Потребовать уменьшения стоимости образовательной услуги;
6.4.4. Расторгнуть Договор.
6.5. Заказчик вправе потребовать полного возмещения убытков, причиненных ему в связи с нарушением сроков начала и (или) окончания оказания образовательной услуги, а также в связи с недостатками образовательной услуги.
6.6. Исполнитель несет ответственность за обработку и сохранение персональных данных Обучающегося в соответствии с требованиями Федерального закона "О персональных данных" от 27.07.2006 № 152-ФЗ.
6.7. Обработка персональных данных Заказчика (либо персональных данных сотрудников Заказчика) будет производиться в программном обеспечении (программа для дистанционного обучения «СДО ПРОФ») сотрудниками Исполнителя для достижения образовательных целей. Исполнитель гарантирует сохранность этих персональных данных.`,
      },
      {
        title: 'VII. Срок действия Договора',
        content: `7.1. Настоящий Договор вступает в силу со дня его заключения Сторонами и действует до полного исполнения Сторонами обязательств.`,
      },
      {
        title: 'VIII. Заключительные положения',
        content: `8.1. Все изменения и дополнения к настоящему Договору должны быть совершены в письменной форме, подписаны уполномоченными представителями сторон и являются его неотъемлемой частью.
8.2. Все споры, которые могут возникнуть из настоящего Договора или в связи с ним, Стороны стремятся разрешить путем переговоров. Возможные претензии Сторон друг к другу должны быть рассмотрены в течении 10 дней с момента их предъявления. При недостижении согласия, спор подлежит рассмотрению в судебном порядке.
8.3. Настоящий Договор составлен в двух экземплярах, один - для Заказчика, один - для Исполнителя. Настоящий договор, а также счета и акты к нему могут быть подписаны Сторонами с использованием факсимильной подписи. Стороны пришли к соглашению, что электронные скан-копии договора, счета и акты имеют юридическую силу, равную оригиналу.
8.4. Исполнитель вправе привлекать к исполнению обязательств по настоящему договору третьих лиц.
8.5. Сведения, указанные в настоящем Договоре, соответствуют информации, размещенной на официальном сайте Исполнителя в сети «Интернет» на дату заключения настоящего Договора.
8.6. Под периодом предоставления образовательной услуги (периодом обучения) понимается промежуток времени с даты издания приказа о зачислении Обучающегося в образовательную организацию до даты издания приказа об окончании обучения или отчислении Обучающегося из образовательной организации.`,
      },
    ];
  }

  private buildAppendixTable(
    lines: OrderLine[],
    totalAmount: number,
    trainingForm: string,
  ): Table {
    const headerRow = new TableRow({
      children: [
        headerCell('Наименование услуги'),
        headerCell('Кол-во часов'),
        headerCell('Форма обучения'),
        headerCell('Кол-во'),
        headerCell('Цена'),
        headerCell('Сумма'),
      ],
      tableHeader: true,
    });

    const dataRows = lines.map((line) => {
      const name = line.subProgramTitle?.trim()
        ? `${line.programTitle} (${line.subProgramTitle}), ${line.hours} ч`
        : `${line.programTitle}, ${line.hours} ч`;
      return new TableRow({
        children: [
          cell(name),
          cellCentered(String(line.hours)),
          cellCentered(trainingForm),
          cellCentered(String(line.quantity)),
          cellCentered(String(line.price)),
          cellCentered(`${line.lineAmount} руб.`),
        ],
      });
    });

    const totalRow = new TableRow({
      children: [
        new TableCell({
          columnSpan: 5,
          margins: { top: 80, bottom: 80, left: CELL_MARGIN, right: CELL_MARGIN },
          verticalAlign: VerticalAlignTable.CENTER,
          children: [
            new Paragraph({
              children: [run('Итого', { bold: true })],
              alignment: AlignmentType.LEFT,
              spacing: { after: 60, line: LINE_SPACING },
            }),
          ],
        }),
        new TableCell({
          margins: { top: 80, bottom: 80, left: CELL_MARGIN, right: CELL_MARGIN },
          verticalAlign: VerticalAlignTable.CENTER,
          children: [
            new Paragraph({
              children: [run(`${totalAmount} руб.`, { bold: true })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 60, line: LINE_SPACING },
            }),
          ],
        }),
      ],
    });

    const colWidths = [
      convertInchesToTwip(2.4),
      convertInchesToTwip(0.55),
      convertInchesToTwip(0.7),
      convertInchesToTwip(0.4),
      convertInchesToTwip(0.55),
      convertInchesToTwip(0.85),
    ];

    return new Table({
      rows: [headerRow, ...dataRows, totalRow],
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: colWidths,
      layout: TableLayoutType.FIXED,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      },
    });
  }

  private async resolveCustomer(order: OrderDoc): Promise<CustomerContract> {
    if (
      order.customerType === OrderCustomerType.ORGANIZATION &&
      order.organization
    ) {
      const org = await this.organizationService.findById(
        (order.organization as { toString: () => string }).toString(),
      );
      if (org) {
        const fullName =
          org.fullName?.trim() || org.displayName?.trim() || org.shortName?.trim() || '—';
        const headPositionGenitive = order.headPositionGenitive?.trim();
        const headFullNameGenitive = order.headFullNameGenitive?.trim();
        const headPosition = order.headPosition?.trim() || '—';
        const headFullName = order.headFullName?.trim() || '—';
        return {
          type: 'organization',
          fullName,
          legalAddress: org.legalAddress?.trim() || '—',
          inn: org.inn ?? '—',
          ogrn: org.ogrn ?? '—',
          bankAccount: org.bankAccount?.trim(),
          bankName: org.bankName?.trim(),
          bik: org.bik?.trim(),
          correspondentAccount: org.correspondentAccount?.trim(),
          headPosition,
          headFullName,
          headPositionGenitive: headPositionGenitive || undefined,
          headFullNameGenitive: headFullNameGenitive || undefined,
        };
      }
    }
    return this.resolveIndividual(order);
  }

  private async resolveIndividual(order: OrderDoc): Promise<CustomerIndividual> {
    const learner = this.getFirstLearner(order);
    const userId = (order.user as { toString: () => string }).toString();
    const profile = await this.userService.getProfileByUserId(userId);

    const fullName =
      learner ? fio(learner) : profile ? fioFromProfile(profile) : '—';
    const registrationAddress =
      learner?.passportRegistrationAddress?.trim() ||
      profile?.passportRegistrationAddress?.trim() ||
      '—';
    const passportIssuedAt = learner?.passportIssuedAt ?? profile?.passport?.issuedAt;

    return {
      type: 'individual',
      fullName,
      registrationAddress,
      passportSeries: learner?.passportSeries ?? profile?.passport?.series,
      passportNumber: learner?.passportNumber ?? profile?.passport?.number,
      passportIssuedBy: learner?.passportIssuedBy ?? profile?.passport?.issuedBy,
      passportIssuedAt,
      phone: order.contactPhone?.trim() || profile?.phone?.trim(),
      email: order.contactEmail?.trim(),
    };
  }

  private getFirstLearner(order: OrderDoc): OrderLineLearner | null {
    const lines = order.lines;
    if (!lines?.length) return null;
    const learners = lines[0].learners;
    return learners?.length ? learners[0] : null;
  }
}

function fio(learner: OrderLineLearner): string {
  const parts = [learner.lastName, learner.firstName, learner.middleName].filter(
    Boolean,
  );
  return parts.join(' ').trim() || '—';
}

function fioFromProfile(profile: {
  lastName?: string;
  firstName?: string;
  middleName?: string;
}): string {
  const parts = [
    profile.lastName,
    profile.firstName,
    profile.middleName,
  ].filter(Boolean);
  return parts.join(' ').trim() || '—';
}
