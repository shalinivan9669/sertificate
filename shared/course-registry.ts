import { additionalSourceDirections } from './source-products';

/** Historical marketing directions and aliases remain in their original order. */
export const legacyCourseDirections = [
  { id: 'ohrana-truda', alias: 'labor-safety', title: { ru: 'Охрана труда', kk: 'Еңбекті қорғау' } },
  { id: 'promyshlennaya-bezopasnost', alias: 'industrial-safety', title: { ru: 'Промышленная безопасность', kk: 'Өнеркәсіптік қауіпсіздік' } },
  { id: 'ptm', alias: 'fire-safety', title: { ru: 'Пожарно-технический минимум', kk: 'Өрт-техникалық минимум' } },
  { id: 'elektrobezopasnost', alias: null, title: { ru: 'Электробезопасность', kk: 'Электр қауіпсіздігі' } },
  { id: 'raboty-na-vysote', alias: null, title: { ru: 'Работы на высоте', kk: 'Биіктіктегі жұмыстар' } },
  { id: 'gpm-stropalschiki', alias: null, title: { ru: 'Грузоподъёмные краны (стропальщики)', kk: 'Жүк көтергіш крандар (стропальшылар)' } },
  { id: 'gazoopasnye-raboty', alias: null, title: { ru: 'Газоопасные работы', kk: 'Газ қауіпті жұмыстар' } },
  { id: 'ekologicheskaya-bezopasnost', alias: null, title: { ru: 'Экологическая безопасность', kk: 'Экологиялық қауіпсіздік' } },
  { id: 'pervaya-pomoshch', alias: null, title: { ru: 'Первая помощь', kk: 'Алғашқы көмек' } },
] as const;

/** Source inventory extends the site; entries are never approved learning content. */
export const courseDirections = [...legacyCourseDirections, ...additionalSourceDirections] as const;

export function resolveCourseDirection(value: unknown) {
  if (typeof value !== 'string') return undefined;
  return courseDirections.find((direction) => direction.id === value || direction.alias === value);
}

/** Never accept protocols, backslashes, encoded slashes, or arbitrary callback destinations. */
export function safeReturnTo(value: unknown, fallback = '/account') {
  if (typeof value !== 'string' || value.length > 2048 || /[\\\u0000-\u001f]/.test(value) || !value.startsWith('/') || value.startsWith('//')) return fallback;
  let decoded: string;
  try { decoded = decodeURIComponent(value); } catch { return fallback; }
  if (/[\\\u0000-\u001f]/.test(decoded) || decoded.startsWith('//') || /%2f|%5c/i.test(decoded)) return fallback;
  const path = decoded.split(/[?#]/, 1)[0] || '';
  return /^\/(?:kk\/)?(?:account|cabinet|learn|exam|courses|admin|b2b|organizations|auth)(?:\/|$)/.test(path) && !path.split('/').includes('..') ? value : fallback;
}
