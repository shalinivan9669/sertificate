import occupationalSafety from '../content/blog/ohrana-truda-kazakhstan-2026.js';
import industrialSafety from '../content/blog/promyshlennaya-bezopasnost-kazakhstan-2026.js';
import fireSafety from '../content/blog/pozharnyj-tekhnicheskiy-minimum.js';
import electricalSafety from '../content/blog/elektrobezopasnost-gruppy-dopuska-kazakhstan-2026.js';
import workAtHeight from '../content/blog/raboty-na-vysote-kazakhstan-2026.js';

export const blogPosts = [occupationalSafety, industrialSafety, fireSafety, electricalSafety, workAtHeight];

// Content revision dates reflect editorial updates, not deployment timestamps.
export const getSortedBlogPosts = () =>
  [...blogPosts].sort((a, b) => new Date(b.updatedAt || b.date).getTime() - new Date(a.updatedAt || a.date).getTime());

export const findBlogPost = (slug) => blogPosts.find((post) => post.slug === slug);

// Explicit month names keep SSR and browsers consistent even with partial ICU data.
export const formatBlogDate = (date, locale = 'ru') => {
  const [year, month, day] = date.split('-').map(Number);
  const months = locale === 'kk'
    ? ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан']
    : ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return `${day} ${months[month - 1]} ${year} ${locale === 'kk' ? 'ж.' : 'г.'}`;
};
