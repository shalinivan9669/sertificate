const financialKey = /^(?:price(?:Minor|Range|Specification)?|amount(?:Minor|Kzt|KZT)?|total(?:Minor|Amount)?|rateTextRaw|offers)$/i;
const moneyText = /\d[\d\s.,]*\s*(?:₸|тенге|KZT|USD|руб(?:\.|лей)|₽)|(?:₸|KZT|USD)\s*\d/i;

/** Reports locations only; financial values must never enter audit output. */
export function publicMoneyFindings(input: unknown, path = '$'): string[] {
  if (typeof input === 'string') return moneyText.test(input) ? [path + ': monetary text'] : [];
  if (!input || typeof input !== 'object') return [];
  return Object.entries(input).flatMap(([key, value]) => {
    const location = path + '.' + key;
    return financialKey.test(key) ? [location + ': financial field'] : publicMoneyFindings(value, location);
  });
}
