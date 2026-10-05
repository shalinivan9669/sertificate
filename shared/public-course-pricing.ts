type PriceLabel = { ru: string; kk: string };

/** Public request copy only. Amounts belong to authenticated server contracts. */
export interface PublicCoursePricing {
  mode: 'request';
  label: PriceLabel;
  basisLabel: PriceLabel;
}

export function getPublicCoursePricing(_directionId: unknown): PublicCoursePricing {
  return {
    mode: 'request',
    label: { ru: 'Стоимость по запросу', kk: 'Бағасы сұрау бойынша' },
    basisLabel: { ru: 'Запросить условия обучения', kk: 'Оқу шарттарын сұрау' },
  };
}