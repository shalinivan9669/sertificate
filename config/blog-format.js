// Explicit month names keep SSR and browsers consistent with partial ICU data.
export const formatBlogDate = (date, locale = 'ru') => {
  const [year, month, day] = date.split('-').map(Number);
  const months = locale === 'kk'
    ? ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан']
    : ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return `${day} ${months[month - 1]} ${year} ${locale === 'kk' ? 'ж.' : 'г.'}`;
};

export const getBlogWordCount = (html) =>
  String(html || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;

export const getBlogReadingMinutes = (html) => Math.max(1, Math.ceil(getBlogWordCount(html) / 180));
