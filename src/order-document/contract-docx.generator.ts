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

/** Ячейка заголовка таблицы приложения (жирный текст, фон). */
function headerCell(text: string): TableCell {
  return new TableCell({
    shading: { fill: 'E8E8E8', type: ShadingType.CLEAR },
    margins: { top: 100, bottom: 100, left: CELL_MARGIN, right: CELL_MARGIN },
    children: [
      new Paragraph({
        children: [run(text, { bold: true })],
        spacing: { after: 60, line: LINE_SPACING },
      }),
    ],
  });
}

/** Ячейка блока реквизитов: несколько абзацев (первая строка — жирный заголовок). */
function requisitesCell(title: string, body: string): TableCell {
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

    // Город и дата
    children.push(
      new Paragraph({
        children: [run(`г. Симферополь\t\t\t\t\t${dateStr}`)],
        spacing: { after: 300, line: LINE_SPACING },
      }),
    );

    // Преамбула
    const preamble =
      customer.type === 'organization'
        ? `${EXECUTOR.fullName} (далее – образовательная организация), осуществляющее образовательную деятельность на основании ${EXECUTOR.license}, именуемое в дальнейшем «Исполнитель», в лице ${EXECUTOR.directorPosition} ${EXECUTOR.directorFullName}, действующего на основании Устава, и ${customer.fullName}, в лице ${customer.headPosition} ${customer.headFullName}, действующего на основании Устава, именуемый в дальнейшем «Заказчик», совместно именуемые «Стороны», заключили настоящий Договор о нижеследующем:`
        : `${EXECUTOR.fullName} (далее – образовательная организация), осуществляющее образовательную деятельность на основании ${EXECUTOR.license}, именуемое в дальнейшем «Исполнитель», в лице ${EXECUTOR.directorPosition} ${EXECUTOR.directorFullName}, действующего на основании Устава, и ${customer.fullName}, паспорт ${customer.passportSeries ?? '—'} ${customer.passportNumber ?? '—'}, зарегистрированный по адресу: ${customer.registrationAddress}, именуемый в дальнейшем «Заказчик», совместно именуемые «Стороны», заключили настоящий Договор о нижеследующем:`;
    children.push(
      new Paragraph({
        children: [run(preamble)],
        spacing: { after: 300, line: LINE_SPACING },
      }),
    );

    // Разделы I–IX: каждая строка — отдельный абзац (как в эталоне), чтобы не обрезало
    const sections = this.buildSectionsItoIX(amountWords, totalAmount);
    sections.forEach((block) => {
      const lines = block.split('\n').filter((s) => s.length > 0);
      lines.forEach((line) => {
        children.push(
          new Paragraph({
            children: [run(line)],
            spacing: { after: SPACING_AFTER, line: LINE_SPACING },
          }),
        );
      });
    });

    // Раздел IX — реквизиты сторон (таблица: слева Исполнитель, справа Заказчик)
    const executorBody =
      `${EXECUTOR.fullName}\n\nЮр. адрес: ${EXECUTOR.legalAddress}\nФакт. адрес: ${EXECUTOR.actualAddress}\nИНН / КПП: ${EXECUTOR.inn} / ${EXECUTOR.kpp}\nОГРН: ${EXECUTOR.ogrn}\nр/с ${EXECUTOR.bankAccount}\nв банке ${EXECUTOR.bankName}\nБИК ${EXECUTOR.bik}\nк/с ${EXECUTOR.correspondentAccount}\n\n${EXECUTOR.phone1}\n${EXECUTOR.phone2}\n${EXECUTOR.email1}\n${EXECUTOR.email2}\n\n${EXECUTOR.directorPosition}\n____________________ ${EXECUTOR.directorFullName}`;

    const customerBody =
      customer.type === 'organization'
        ? (() => {
            const customerBank =
              customer.bankAccount && customer.bankName && customer.bik
                ? `р/с ${customer.bankAccount}\nв банке ${customer.bankName}\nк/с ${customer.correspondentAccount ?? '—'}\nБИК ${customer.bik}`
                : 'р/с —\nк/с —\nБИК —';
            return `${customer.fullName}\n\nЮр. адрес: ${customer.legalAddress}\nИНН: ${customer.inn}\nОГРН: ${customer.ogrn}\n\n${customerBank}\n\n${customer.headPosition}\n__________________________ ${customer.headFullName}`;
          })()
        : `${customer.fullName}\n\nАдрес регистрации: ${customer.registrationAddress}\n\nПаспорт: серия ${customer.passportSeries ?? '—'} № ${customer.passportNumber ?? '—'}\nВыдан: ${customer.passportIssuedBy ?? '—'} ${customer.passportIssuedAt ? formatDateShort(customer.passportIssuedAt) : ''}\n${customer.phone ? `Тел.: ${customer.phone}` : ''}\n${customer.email ? `E-mail: ${customer.email}` : ''}\n\nЗаказчик\n__________________________ ${customer.fullName}`;

    const colWidth = convertInchesToTwip(3.2);
    const requisitesTable = new Table({
      rows: [
        new TableRow({
          children: [
            requisitesCell('ИСПОЛНИТЕЛЬ', executorBody),
            requisitesCell('ЗАКАЗЧИК', customerBody),
          ],
        }),
      ],
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [colWidth, colWidth],
      layout: TableLayoutType.FIXED,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      },
    });

    children.push(
      new Paragraph({
        children: [run('IX. Адреса и реквизиты сторон', { bold: true })],
        spacing: { after: 200, line: LINE_SPACING },
      }),
      requisitesTable,
      new Paragraph({ children: [], spacing: { after: 300 } }),
    );

    // Приложение № 1 — с новой страницы
    children.push(
      new Paragraph({
        children: [run(`Приложение № 1\nк Договору № ${contractNumber} от ${dateStr}`)],
        pageBreakBefore: true,
        spacing: { after: 200, line: LINE_SPACING },
      }),
      new Paragraph({
        children: [run('Перечень дополнительных профессиональных программ и количества слушателей')],
        spacing: { after: 300, line: LINE_SPACING },
      }),
    );

    const table = this.buildAppendixTable(order.lines ?? [], totalAmount, trainingForm);
    children.push(table);

    // Подписи под приложением
    const customerSignature =
      customer.type === 'organization'
        ? `${customer.headPosition}\n______________________${customer.headFullName}`
        : `Заказчик\n______________________${customer.fullName}`;
    children.push(
      new Paragraph({
        children: [
          run(
            `ИСПОЛНИТЕЛЬ: ${EXECUTOR.fullName}\n\n${EXECUTOR.directorPosition}\n______________________ ${EXECUTOR.directorFullName}`,
          ),
        ],
        spacing: { after: 200, line: LINE_SPACING },
      }),
      new Paragraph({
        children: [run(`ЗАКАЗЧИК:\n${customer.fullName}\n\n${customerSignature}`)],
        spacing: { after: 200, line: LINE_SPACING },
      }),
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

  private buildSectionsItoIX(amountWords: string, totalAmount: number): string[] {
    return [
      'I. Предмет Договора\n1.1. Исполнитель обязуется предоставить образовательную услугу, а Заказчик обязуется оплатить образовательную услугу по предоставлению дополнительной профессиональной образовательной программы повышения квалификации согласно Приложению № 1 к Договору.\n1.2. После освоения обучающимися образовательных программ и успешного прохождения итоговой аттестации им выдаются документы об образовании установленного образца.',
      'II. Права Исполнителя, Заказчика и Обучающегося\n2.1. Исполнитель вправе: самостоятельно осуществлять образовательный процесс, устанавливать системы оценок, формы, порядок и периодичность проведения промежуточной аттестации; применять меры поощрения и дисциплинарного взыскания. 2.2. Заказчик вправе получать информацию от Исполнителя. 2.3. Обучающемуся предоставляются академические права в соответствии с частью 1 статьи 34 ФЗ «Об образовании в Российской Федерации».',
      'III. Обязанности Исполнителя, Заказчика и Обучающегося\n3.1. Исполнитель обязан зачислить Обучающегося при выполнении условий приема, довести информацию о платных услугах, организовать предоставление образовательных услуг, сохранить место при пропуске по уважительным причинам. 3.2. Заказчик обязан своевременно вносить плату и предоставлять документы (заявка, копии паспорта и документа об образовании, анкета, согласие на обработку персональных данных). 3.3. Обучающийся обязан соблюдать требования статьи 43 ФЗ «Об образовании в Российской Федерации».',
      `IV. Стоимость услуг, сроки и порядок их оплаты\n4.1. Полная стоимость платных образовательных услуг за весь период обучения составляет ${totalAmount} руб. (${amountWords}). Увеличение стоимости после заключения Договора не допускается, за исключением увеличения с учетом уровня инфляции.\n4.2. Оплата производится на условиях 100% предоплаты, не позднее 3 рабочих дней с момента выставления счета, в безналичном порядке на счет, указанный в разделе IХ. НДС не начисляется.\n4.3. По завершении обучения Сторонами в течение 3 рабочих дней подписывается двухсторонний Акт приема-передачи выполненных работ (оказанных услуг).`,
      'V. Основания изменения и расторжения договора\n5.1. Условия могут быть изменены по соглашению Сторон или в соответствии с законодательством РФ. 5.2. Договор может быть расторгнут по соглашению Сторон. 5.3–5.6. Исполнитель вправе отказаться при условии полного возмещения Заказчику убытков. Заказчик вправе отказаться при условии оплаты Исполнителю фактически понесенных расходов.',
      'VI. Ответственность\n6.1. За неисполнение обязательств Стороны несут ответственность по законодательству РФ и Договору. 6.2–6.5. Заказчик вправе потребовать безвозмездного оказания услуги, уменьшения стоимости, возмещения расходов; при нарушении сроков — назначить новый срок или расторгнуть Договор. 6.6. Исполнитель несет ответственность за обработку персональных данных по ФЗ "О персональных данных" от 27.07.2006 № 152-ФЗ. 6.7. Обработка персональных данных Заказчика производится в ПО «СДО ПРОФ» сотрудниками Исполнителя.',
      'VII. Срок действия Договора\n7.1. Настоящий Договор вступает в силу со дня его заключения Сторонами и действует до полного исполнения обязательств.',
      'VIII. Заключительные положения\n8.1. Изменения и дополнения совершаются в письменной форме. 8.2. Споры разрешаются путем переговоров; претензии — в течение 10 дней; при недостижении согласия — в судебном порядке. 8.3. Договор составлен в двух экземплярах. Договор, счета и акты могут быть подписаны факсимильной подписью; скан-копии имеют юридическую силу, равную оригиналу. 8.4. Исполнитель вправе привлекать третьих лиц. 8.5. Сведения соответствуют информации на сайте Исполнителя на дату заключения. 8.6. Период обучения — с даты приказа о зачислении до даты приказа об окончании или отчислении.',
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
        headerCell('Цена продажи'),
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
          cell(String(line.hours)),
          cell(trainingForm),
          cell(String(line.quantity)),
          cell(String(line.price)),
          cell(`${line.lineAmount} руб.`),
        ],
      });
    });

    const totalRow = new TableRow({
      children: [
        cell('ИТОГО'),
        cell('—'),
        cell('—'),
        cell('—'),
        cell('—'),
        cell(`${totalAmount} руб.`),
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
        const fullName = org.fullName?.trim() || org.displayName?.trim() || '—';
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
          headPosition: order.headPosition?.trim() || '—',
          headFullName: order.headFullName?.trim() || '—',
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
