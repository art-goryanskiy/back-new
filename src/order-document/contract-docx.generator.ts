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
} from 'docx';
import type { OrderDocument as OrderDoc } from 'src/order/order.schema';
import type { OrderLine } from 'src/order/order.schema';
import { OrderCustomerType } from 'src/order/order.enums';
import { OrganizationService } from 'src/organization/organization.service';
import { EXECUTOR } from './executor.constants';
import { rublesInWords } from './rubles-in-words';

export interface CustomerRequisites {
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

function cell(text: string): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, size: 22 })],
        spacing: { after: 80 },
      }),
    ],
  });
}

@Injectable()
export class ContractDocxGenerator {
  constructor(private readonly organizationService: OrganizationService) {}

  async generateDocx(
    order: OrderDoc,
    documentDate: Date,
    contractNumber: string,
  ): Promise<Buffer> {
    const customer = await this.resolveCustomer(order);
    if (!customer) {
      throw new Error('Договор формируется только для заказа от организации');
    }
    const totalAmount = Number(order.totalAmount ?? 0);
    const amountWords = rublesInWords(totalAmount);
    const dateStr = formatContractDate(documentDate);
    const trainingForm = order.trainingForm?.trim() || '—';

    const children: (Paragraph | Table)[] = [];

    // Заголовок
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `ДОГОВОР № ${contractNumber}`,
            bold: true,
            size: 28,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'об образовании на обучение по дополнительным',
            size: 24,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'образовательным программам',
            size: 24,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
    );

    // Город и дата (справа)
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'г. Симферополь', size: 22 }),
          new TextRun({ text: '\t\t\t\t', size: 22 }),
          new TextRun({ text: dateStr, size: 22 }),
        ],
        alignment: AlignmentType.START,
        spacing: { after: 400 },
      }),
    );

    // Преамбула
    const preamble =
      `${EXECUTOR.fullName} (далее – образовательная организация), осуществляющее образовательную деятельность на основании ${EXECUTOR.license}, именуемое в дальнейшем «Исполнитель», в лице ${EXECUTOR.directorPosition} ${EXECUTOR.directorFullName}, действующего на основании Устава, и ${customer.fullName}, в лице ${customer.headPosition} ${customer.headFullName}, действующего на основании Устава, именуемый в дальнейшем «Заказчик», совместно именуемые «Стороны», заключили настоящий Договор о нижеследующем:`;
    children.push(
      new Paragraph({
        children: [new TextRun({ text: preamble, size: 22 })],
        spacing: { after: 300 },
      }),
    );

    // Разделы I–IX (сокращённо для читаемости; полный текст по образцу)
    const sections = this.buildSectionsItoIX(amountWords, totalAmount);
    sections.forEach((text) => {
      children.push(
        new Paragraph({
          children: [new TextRun({ text, size: 22 })],
          spacing: { after: 200 },
        }),
      );
    });

    // Раздел IX — реквизиты
    const executorRequisites =
      `ИСПОЛНИТЕЛЬ:\n${EXECUTOR.fullName}\n\nЮр. адрес: ${EXECUTOR.legalAddress}\nФакт. адрес: ${EXECUTOR.actualAddress}\nИНН / КПП: ${EXECUTOR.inn}/ ${EXECUTOR.kpp}\nОГРН: ${EXECUTOR.ogrn}\nр/с ${EXECUTOR.bankAccount} в банке ${EXECUTOR.bankName}\nБИК ${EXECUTOR.bik} к/с ${EXECUTOR.correspondentAccount}\n${EXECUTOR.phone1}\n${EXECUTOR.phone2}\n${EXECUTOR.email1}\n${EXECUTOR.email2}\n\n${EXECUTOR.directorPosition}\n____________________ ${EXECUTOR.directorFullName}`;

    const customerBank =
      customer.bankAccount && customer.bankName && customer.bik
        ? `р/с ${customer.bankAccount} в банке ${customer.bankName}\nк/с ${customer.correspondentAccount ?? '—'}\nБИК банка (БИК ТОФК)-${customer.bik}`
        : 'р/с —\nк/с —\nБИК банка —';

    const customerRequisites =
      `ЗАКАЗЧИК:\n${customer.fullName}\n\nЮр. адрес: ${customer.legalAddress}\nИНН: ${customer.inn}\nОГРН: ${customer.ogrn}\n${customerBank}\n\n${customer.headPosition}\n__________________________${customer.headFullName}`;

    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'IX. Адреса и реквизиты сторон', bold: true, size: 22 })],
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [new TextRun({ text: executorRequisites, size: 22 })],
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [new TextRun({ text: customerRequisites, size: 22 })],
        spacing: { after: 400 },
      }),
    );

    // Приложение № 1
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Приложение №1\nк Договору № ${contractNumber} от ${dateStr}`,
            size: 22,
          }),
        ],
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'Перечень\nдополнительных профессиональных программ и количества слушателей',
            size: 22,
          }),
        ],
        spacing: { after: 300 },
      }),
    );

    const table = this.buildAppendixTable(order.lines ?? [], totalAmount, trainingForm);
    children.push(table);

    // Подписи под приложением
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `ИСПОЛНИТЕЛЬ: ${EXECUTOR.fullName}\n\n${EXECUTOR.directorPosition}\n______________________ ${EXECUTOR.directorFullName}`,
            size: 22,
          }),
        ],
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `ЗАКАЗЧИК:\n${customer.fullName}\n\n${customer.headPosition}\n______________________${customer.headFullName}`,
            size: 22,
          }),
        ],
        spacing: { after: 200 },
      }),
    );

    const doc = new Document({
      sections: [
        {
          properties: {},
          children,
        },
      ],
    });

    return Packer.toBuffer(doc);
  }

  private buildSectionsItoIX(amountWords: string, totalAmount: number): string[] {
    return [
      'I. Предмет Договора\n1.1. Исполнитель обязуется предоставить образовательную услугу, а Заказчик обязуется оплатить образовательную услугу по предоставлению дополнительной профессиональной образовательной программы повышения квалификации согласно Приложения №1 к Договору.\n1.2. После освоения обучающимися образовательных программ и успешного прохождения итоговой аттестации им выдаются документы об образовании установленного образца.',
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
        cell('Наименование услуги'),
        cell('Кол-во часов'),
        cell('Форма обучения'),
        cell('Кол-во'),
        cell('Цена продажи'),
        cell('Сумма'),
      ],
      tableHeader: true,
    });

    const dataRows = lines.map((line) => {
      const name = line.subProgramTitle?.trim()
        ? `${line.programTitle} (${line.subProgramTitle}) -${line.hours} часов`
        : `${line.programTitle} -${line.hours} часов`;
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

    return new Table({
      rows: [headerRow, ...dataRows, totalRow],
      width: { size: 100, type: WidthType.PERCENTAGE },
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

  private async resolveCustomer(order: OrderDoc): Promise<CustomerRequisites | null> {
    if (order.customerType !== OrderCustomerType.ORGANIZATION || !order.organization) {
      return null;
    }
    const org = await this.organizationService.findById(
      (order.organization as { toString: () => string }).toString(),
    );
    if (!org) return null;
    const fullName = org.fullName?.trim() || org.displayName?.trim() || '—';
    return {
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
