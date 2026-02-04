const MAX_RATING = 5;
const RATING_COEFFICIENT = 1.2;

/**
 * Нормализованный рейтинг популярности 0..5 по количеству просмотров.
 * Логарифмическая шкала: новые программы не остаются с нулём, рост замедляется с ростом views.
 */
export function getViewsRating(views: number): number {
  if (views <= 0) return 0;
  const score = Math.log10(views + 1) * RATING_COEFFICIENT;
  return Math.min(MAX_RATING, Math.round(score * 10) / 10);
}
