import { resolveCourseDirection } from '../../shared/course-registry';
import { getSourceProductForDirection, type SourceProduct } from '../../shared/source-products';

type PriceLabel = { ru: string; kk: string };
export interface InventoryPricing {
  mode: 'published' | 'request';
  amountMinor: number | null;
  currency: 'KZT';
  basis: 'organization' | 'learner' | null;
  label: PriceLabel;
  basisLabel: PriceLabel;
  taxLabel: PriceLabel;
}

// Server-only inventory rates. Never import this module into public pages.
// These amounts do not update approved program versions, orders or checkout rules.
const publicAmountMinorBySource: Record<SourceProduct['id'], number> = {
  'kbpk-01': 30_630_000,
  'kbpk-02': 2_500_000,
  'kbpk-03': 30_630_000,
  'kbpk-04': 30_630_000,
  'kbpk-05': 30_630_000,
  'kbpk-06': 2_500_000,
  'kbpk-07': 2_500_000,
  'kbpk-08': 2_500_000,
  'kbpk-09': 2_500_000,
  'kbpk-10': 9_500_000,
  'kbpk-11': 9_500_000,
  'kbpk-12': 9_500_000,
  'kbpk-13': 9_500_000,
  'kbpk-14': 7_000_000,
  'kbpk-15': 6_000_000,
  'kbpk-16': 10_000_000,
};
const kztAmountFormatter = new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 2 });

export function getInventoryPricing(directionId: unknown): InventoryPricing {
  const direction = resolveCourseDirection(directionId);
  const source = getSourceProductForDirection(direction?.id);
  if (!source) return {
    mode: 'request', amountMinor: null, currency: 'KZT', basis: null,
    label: { ru: 'Стоимость по запросу', kk: 'Бағасы сұрау бойынша' },
    basisLabel: { ru: 'Уточним условия обучения', kk: 'Оқу шарттарын нақтылаймыз' },
    taxLabel: { ru: '', kk: '' },
  };

  const amountMinor = publicAmountMinorBySource[source.id];
  const amount = kztAmountFormatter.format(amountMinor / 100) + ' ₸';
  return {
    mode: 'published', amountMinor, currency: 'KZT', basis: source.pricingBasis,
    label: { ru: amount, kk: amount },
    basisLabel: source.pricingBasis === 'organization'
      ? { ru: 'За организацию', kk: 'Ұйым үшін' }
      : { ru: 'За одного слушателя', kk: 'Бір тыңдаушы үшін' },
    taxLabel: { ru: 'Без НДС', kk: 'ҚҚС-сыз' },
  };
}
