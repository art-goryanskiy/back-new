/**
 * Преобразование суммы в рубли/копейки в пропись для договоров.
 * Пример: 7000.5 -> "семь тысяч рублей 50 копеек"
 */
const UNITS = [
  '',
  'один',
  'два',
  'три',
  'четыре',
  'пять',
  'шесть',
  'семь',
  'восемь',
  'девять',
];
const TEENS = [
  'десять',
  'одиннадцать',
  'двенадцать',
  'тринадцать',
  'четырнадцать',
  'пятнадцать',
  'шестнадцать',
  'семнадцать',
  'восемнадцать',
  'девятнадцать',
];
const TENS = [
  '',
  '',
  'двадцать',
  'тридцать',
  'сорок',
  'пятьдесят',
  'шестьдесят',
  'семьдесят',
  'восемьдесят',
  'девяносто',
];
const HUNDREDS = [
  '',
  'сто',
  'двести',
  'триста',
  'четыреста',
  'пятьсот',
  'шестьсот',
  'семьсот',
  'восемьсот',
  'девятьсот',
];

function tripleToWords(n: number, female: boolean): string {
  if (n === 0) return '';
  const u = n % 10;
  const t = Math.floor((n % 100) / 10);
  const h = Math.floor(n / 100);
  const parts: string[] = [];
  if (h > 0) parts.push(HUNDREDS[h]);
  if (t === 1) {
    parts.push(TEENS[u]);
  } else {
    if (t > 0) parts.push(TENS[t]);
    if (u > 0) {
      if (female && (n % 100 < 10 || n % 100 >= 20)) {
        const oneTwo = ['', 'одна', 'две'];
        parts.push(oneTwo[u] || UNITS[u]);
      } else {
        parts.push(UNITS[u]);
      }
    }
  }
  return parts.join(' ');
}

function pluralRubles(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'рублей';
  if (mod10 === 1) return 'рубль';
  if (mod10 >= 2 && mod10 <= 4) return 'рубля';
  return 'рублей';
}

function pluralKopecks(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'копеек';
  if (mod10 === 1) return 'копейка';
  if (mod10 >= 2 && mod10 <= 4) return 'копейки';
  return 'копеек';
}

export function rublesInWords(amount: number): string {
  const rub = Math.floor(amount);
  const kop = Math.round((amount - rub) * 100) % 100;
  if (rub === 0 && kop === 0) return 'ноль рублей 00 копеек';
  const kopStr = String(kop).padStart(2, '0');
  const kopWord = pluralKopecks(kop);

  if (rub === 0) return `ноль рублей ${kopStr} ${kopWord}`;

  const millions = Math.floor(rub / 1_000_000);
  const thousands = Math.floor((rub % 1_000_000) / 1000);
  const units = rub % 1000;

  const parts: string[] = [];
  if (millions > 0) {
    const m = tripleToWords(millions, false);
    if (m) {
      const word =
        millions === 1
          ? 'миллион'
          : millions >= 2 && millions <= 4
            ? 'миллиона'
            : 'миллионов';
      parts.push(m, word);
    }
  }
  if (thousands > 0) {
    const t = tripleToWords(thousands, true);
    if (t) {
      const word =
        thousands === 1
          ? 'тысяча'
          : thousands >= 2 && thousands <= 4
            ? 'тысячи'
            : 'тысяч';
      parts.push(t, word);
    }
  }
  if (units > 0 || parts.length === 0) {
    const u = tripleToWords(units, false);
    if (u) parts.push(u);
  }
  const rubWord = pluralRubles(rub);
  return `${parts.join(' ')} ${rubWord} ${kopStr} ${pluralKopecks(kop)}`;
}
