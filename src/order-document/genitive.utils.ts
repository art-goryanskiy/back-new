/**
 * Склонение должности и ФИО в родительный падеж для преамбулы договора
 * («в лице Директора Иванова Ивана Ивановича»).
 */

/** Склонение должности в род. п. (упрощённые правила для типичных формулировок). */
export function declinePositionToGenitive(position: string): string {
  const s = position.trim();
  if (!s) return s;
  const words = s.split(/\s+/);
  if (words.length === 1) {
    return declineWordToGenitive(s);
  }
  const result = words.map((w, i) => {
    if (i === words.length - 1) {
      return declineWordToGenitive(w);
    }
    return declineAdjectiveToGenitive(w);
  });
  return result.join(' ');
}

/** Прилагательное в род. п. (муж. род): -ый/-ий -> -ого/-его, -ой -> -ого. */
function declineAdjectiveToGenitive(word: string): string {
  const w = word.trim();
  if (!w) return w;
  if (/(ый|ий)$/i.test(w)) {
    return w.replace(/(ый|ий)$/i, (m) => (m.toLowerCase() === 'ий' ? 'его' : 'ого'));
  }
  if (/ой$/i.test(w)) return w.replace(/ой$/i, 'ого');
  return w;
}

/** Одно слово должности: директор->директора, начальник->начальника и т.д. */
function declineWordToGenitive(word: string): string {
  const w = word.trim();
  if (!w) return w;
  const lower = w.toLowerCase();
  const map: Record<string, string> = {
    директор: 'директора',
    начальник: 'начальника',
    руководитель: 'руководителя',
    председатель: 'председателя',
    президент: 'президента',
    генеральный: 'генерального',
    исполнительный: 'исполнительного',
    заместитель: 'заместителя',
    первый: 'первого',
    главный: 'главного',
  };
  const mapped = map[lower];
  if (mapped) {
    return preserveCase(w, mapped);
  }
  if (/(тель)$/i.test(w)) return w.replace(/(тель)$/i, 'теля');
  if (/(ник)$/i.test(w)) return w.replace(/(ник)$/i, 'ника');
  if (/(тор)$/i.test(w)) return w.replace(/(тор)$/i, 'тора');
  if (/(дент)$/i.test(w)) return w.replace(/(дент)$/i, 'дента');
  return w + 'а';
}

/** Склонение ФИО (Фамилия Имя Отчество) в род. п. */
export function declineFullNameToGenitive(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fullName;
  if (parts.length === 1) return declineSurnameToGenitive(parts[0]);
  if (parts.length === 2) {
    return `${declineSurnameToGenitive(parts[0])} ${declineFirstNameToGenitive(parts[1])}`;
  }
  return `${declineSurnameToGenitive(parts[0])} ${declineFirstNameToGenitive(parts[1])} ${declinePatronymicToGenitive(parts[2])}`;
}

function declineSurnameToGenitive(s: string): string {
  const w = s.trim();
  if (!w) return w;
  if (/(ов|ев|ин|ын)$/i.test(w)) return w.replace(/(ов|ев|ин|ын)$/i, '$1а');
  if (/(ий|ый|ой)$/i.test(w)) return w.replace(/(ий|ый|ой)$/i, (m) => (m === 'ий' ? 'его' : 'ого'));
  if (/ая$/i.test(w)) return w.replace(/ая$/i, 'ой');
  if (/а$/i.test(w) && w.length > 2) return w.replace(/а$/i, 'ы');
  if (/ь$/i.test(w)) return w.replace(/ь$/i, 'я');
  if (/й$/i.test(w)) return w.replace(/й$/i, 'я');
  return w + 'а';
}

function declineFirstNameToGenitive(s: string): string {
  const w = s.trim();
  if (!w) return w;
  if (/ей$/i.test(w)) return w.replace(/ей$/i, 'ея');
  if (/ий$/i.test(w)) return w.replace(/ий$/i, 'ия');
  if (/й$/i.test(w)) return w.replace(/й$/i, 'я');
  if (/ь$/i.test(w)) return w.replace(/ь$/i, 'я');
  if (/а$/i.test(w)) return w.replace(/а$/i, 'ы');
  if (/я$/i.test(w)) return w.replace(/я$/i, 'и');
  return w + 'а';
}

function declinePatronymicToGenitive(s: string): string {
  const w = s.trim();
  if (!w) return w;
  if (/(ович|евич|ич)$/i.test(w)) return w.replace(/(ович|евич|ич)$/i, '$1а');
  if (/(овна|евна|инична|ична)$/i.test(w)) return w.replace(/(овна|евна|инична|ична)$/i, (m) => m.replace(/а$/, 'ы'));
  return w + 'а';
}

function preserveCase(original: string, declined: string): string {
  if (original === original.toUpperCase()) return declined.toUpperCase();
  if (original[0] === original[0].toUpperCase()) {
    return declined.charAt(0).toUpperCase() + declined.slice(1);
  }
  return declined;
}
