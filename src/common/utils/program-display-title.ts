/**
 * Шаблоны наименований для документов (заказ, счёт) по типу категории.
 * Значения categoryType соответствуют enum CategoryType (qualification_upgrade, professional_retraining, professional_education).
 */
const TITLES: Record<string, string> = {
  qualification_upgrade:
    'Оказание образовательной услуги по программе повышения квалификации',
  professional_retraining:
    'Оказание образовательной услуги по программе профессиональной переподготовки',
  professional_education:
    'Оказание образовательной услуги по программе профессионального обучения',
};

/**
 * Формирует дополненное наименование программы/подпрограммы для документов.
 * Если тип категории известен — подставляет шаблон и название в кавычках; иначе возвращает исходное название.
 */
export function buildProgramDisplayTitle(
  categoryType: string | undefined,
  programOrSubprogramTitle: string,
): string {
  const prefix = categoryType ? TITLES[categoryType] : undefined;
  const title = (programOrSubprogramTitle || '').trim();
  if (!prefix) return title || 'Позиция';
  return `${prefix} «${title}»`;
}
