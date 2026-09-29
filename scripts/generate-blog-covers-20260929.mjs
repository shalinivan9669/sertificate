import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Original editable vector diagrams, not photographs or official document forms.
// Run with an installed sharp package, or pass its absolute entry path as argv[2].
const require = createRequire(import.meta.url);
const sharp = require(process.argv[2] || 'sharp');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'public/images/blog');
const C = { ink: '#10262a', teal: '#236a6b', paper: '#f5f5f0', pale: '#dde8e1', white: '#ffffff', rule: '#baccc4', muted: '#526b6b', amber: '#b9984c' };
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const text = (x, y, value, size = 30, fill = C.ink, weight = 400, anchor = 'start') => `<text x="${x}" y="${y}" fill="${fill}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${escape(value)}</text>`;
const rect = (x, y, width, height, fill = C.white, stroke = 'none', radius = 12) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="3"/>`;
const line = (x1, y1, x2, y2, color = C.rule, width = 4) => `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
const circle = (x, y, radius, fill, stroke = 'none', width = 3) => `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
const check = (x, y, color = C.teal, scale = 1) => `<path d="M${x} ${y}l${16 * scale} ${16 * scale}l${32 * scale} ${-38 * scale}" fill="none" stroke="${color}" stroke-width="${7 * scale}" stroke-linecap="round" stroke-linejoin="round"/>`;
const arrow = (x, y, width = 80, color = C.teal) => `${line(x, y, x + width, y, color, 5)}<path d="M${x + width - 14} ${y - 12}l14 12l-14 12" fill="none" stroke="${color}" stroke-width="5" stroke-linejoin="round"/>`;
const dotRow = (x, y, label, index) => `${circle(x, y - 8, 22, C.teal)}${text(x, y + 2, index, 25, C.white, 700, 'middle')}${text(x + 44, y + 3, label, 30)}`;

const covers = [
  {
    slug: 'biot-novye-pravila-2026-2027',
    title: ['БиОТ: переход', 'к новым правилам'],
    subtitle: ['Как разобраться в требованиях', 'и подготовить обучение'],
    label: 'Редакции • категории • документы',
    diagram: () => `${rect(827, 270, 247, 158, C.ink)}${text(950, 365, '2026', 64, C.white, 700, 'middle')}${rect(1133, 270, 247, 158, C.pale)}${text(1256, 365, '2027', 64, C.ink, 700, 'middle')}${arrow(1088, 349, 31)}${line(950, 448, 950, 499, C.teal)}${line(950, 499, 1237, 499, C.teal)}${line(1237, 499, 1237, 542, C.teal)}${rect(827, 546, 553, 231, C.white, C.rule)}${dotRow(872, 599, 'Проверить редакцию', '1')}${dotRow(872, 668, 'Определить категорию', '2')}${dotRow(872, 737, 'Согласовать программу', '3')}`,
  },
  {
    slug: 'ptm-rasshifrovka-programmy-2026',
    title: ['ПТМ: что стоит', 'за аббревиатурой'],
    subtitle: ['Кому нужна подготовка', 'по пожарной безопасности'],
    label: 'Программа • сотрудники • результат',
    diagram: () => `${rect(831, 274, 545, 499, C.white, C.rule)}${rect(831, 274, 545, 126, C.ink)}${text(887, 359, 'ПТМ', 67, C.white, 700)}<path d="M1261 368c-50-14-41-55-15-71c-3 22 33 29 23 52c19-11 19-21 17-30c28 29 10 51-25 49Z" fill="${C.amber}"/>${text(877, 460, 'Пожарно-технический', 31, C.ink, 700)}${text(877, 502, 'минимум', 31, C.ink, 700)}${line(877, 537, 1331, 537)}${check(882, 588)}${text(954, 596, 'Кого обучать', 30)}${check(882, 650)}${text(954, 658, 'Какой курс выбрать', 30)}${check(882, 712)}${text(954, 720, 'Что проверить', 30)}`,
  },
  {
    slug: 'reestr-professionalnyh-riskov-2026',
    title: ['Профессиональные', 'риски: свой реестр'],
    subtitle: ['От рабочего процесса', 'к понятным мерам защиты'],
    label: 'Опасность • оценка • меры',
    diagram: () => `${text(852, 294, 'Оценка ситуации', 31, C.ink, 700)}${[0, 1, 2].map((row) => [0, 1, 2].map((col) => rect(852 + col * 168, 326 + row * 103, 152, 88, [C.pale, '#b6cfbe', C.amber][Math.min(2, Math.floor((row + col) / 2))], 'none', 6)).join('')).join('')}${circle(1096, 470, 22, C.ink)}${text(1096, 479, '!', 26, C.white, 700, 'middle')}${arrow(870, 686, 145)}${rect(1046, 642, 303, 93, C.ink)}${text(1197, 701, 'Меры защиты', 31, C.white, 700, 'middle')}${text(852, 786, 'Условная схема, не готовая оценка', 24, C.muted)}`,
  },
  {
    slug: 'gazoopasnye-raboty-dopusk-kazakhstan',
    title: ['Газоопасные работы:', 'подготовка допуска'],
    subtitle: ['Что согласовать до выхода', 'бригады на объект'],
    label: 'Условия • ответственность • документы',
    diagram: () => `${circle(1102, 517, 174, C.pale)}${line(899, 369, 1270, 369, C.rule, 6)}${line(1270, 369, 1270, 671, C.rule, 6)}${line(1270, 671, 899, 671, C.rule, 6)}${line(899, 671, 899, 369, C.rule, 6)}${rect(829, 296, 228, 146, C.white, C.rule)}${text(943, 358, 'Условия', 30, C.ink, 700, 'middle')}${text(943, 404, 'работы', 30, C.ink, 400, 'middle')}${rect(1147, 296, 228, 146, C.white, C.rule)}${text(1261, 358, 'Ответственные', 25, C.ink, 700, 'middle')}${text(1261, 404, 'лица', 30, C.ink, 400, 'middle')}${rect(829, 598, 228, 146, C.white, C.rule)}${text(943, 660, 'Подготовка', 28, C.ink, 700, 'middle')}${text(943, 706, 'бригады', 30, C.ink, 400, 'middle')}${rect(1147, 598, 228, 146, C.white, C.rule)}${text(1261, 660, 'Наряд', 30, C.ink, 700, 'middle')}${text(1261, 706, 'и контроль', 28, C.ink, 400, 'middle')}${circle(1102, 520, 74, C.ink)}${check(1078, 521, C.white, 1.05)}`,
  },
  {
    slug: 'prombezopasnost-itr-periodichnost-obucheniya',
    title: ['Промбезопасность', 'для ИТР'],
    subtitle: ['Как определить программу', 'и срок следующей проверки'],
    label: 'Функции • программа • срок',
    diagram: () => `${rect(849, 271, 509, 502, C.white, C.rule)}${rect(849, 271, 509, 106, C.ink)}${text(891, 340, 'Карточка обучения', 35, C.white, 700)}${text(891, 430, 'Функции на объекте', 28, C.muted)}${line(891, 455, 1313, 455)}${text(891, 510, 'Программа подготовки', 28, C.muted)}${line(891, 535, 1313, 535)}${text(891, 590, 'Основание и дата', 28, C.muted)}${line(891, 615, 1313, 615)}${circle(1274, 704, 46, C.pale)}${line(1274, 704, 1274, 677, C.teal, 5)}${line(1274, 704, 1295, 713, C.teal, 5)}${text(891, 714, 'Следующая проверка', 28, C.ink, 700)}`,
  },
  {
    slug: 'elektrobezopasnost-prisvoenie-gruppy-dokumenty-rk',
    title: ['Группа по', 'электробезопасности'],
    subtitle: ['Какие сведения и документы', 'подготовить работодателю'],
    label: 'Обязанности • знания • подтверждение',
    diagram: () => `${text(852, 310, 'Группы I–V', 40, C.ink, 700)}${['I', 'II', 'III', 'IV', 'V'].map((value, index) => `${rect(850 + index * 106, 356, 92, 96, index === 2 ? C.teal : C.pale)}${text(896 + index * 106, 420, value, 41, index === 2 ? C.white : C.ink, 700, 'middle')}`).join('')}${line(1108, 474, 1108, 514, C.teal)}${rect(849, 523, 522, 226, C.white, C.rule)}${dotRow(897, 578, 'Обязанности и установки', '1')}${dotRow(897, 646, 'Подготовка и проверка', '2')}${dotRow(897, 714, 'Оформление результата', '3')}${text(852, 800, 'Группа определяется требованиями к работе', 23, C.muted)}`,
  },
  {
    slug: 'udostoverenie-ohrana-truda-proverka-kazakhstan',
    title: ['Документ об обучении:', 'как его проверить'],
    subtitle: ['Сверка реквизитов', 'и подтверждение результата'],
    label: 'Сотрудник • программа • выдача',
    diagram: () => `${rect(848, 276, 412, 497, C.white, C.rule)}${rect(883, 317, 342, 59, C.pale)}${text(908, 358, 'Документ об обучении', 27, C.ink, 700)}${text(887, 439, 'ФИО сотрудника', 27, C.muted)}${line(887, 466, 1220, 466)}${text(887, 522, 'Название программы', 27, C.muted)}${line(887, 549, 1220, 549)}${text(887, 605, 'Дата выдачи', 27, C.muted)}${line(887, 632, 1220, 632)}${circle(1281, 695, 98, C.pale, C.teal, 13)}${line(1349, 769, 1421, 844, C.teal, 19)}${check(1249, 699, C.teal, 1.4)}${text(887, 704, 'Проверка', 26, C.ink, 700)}${text(887, 742, 'реквизитов', 26, C.ink, 700)}`,
  },
  {
    slug: 'ohrana-truda-tehnika-bezopasnosti-raznica',
    title: ['Охрана труда', 'и техника безопасности'],
    subtitle: ['В чём разница', 'и как связаны эти понятия'],
    label: 'Система • организация • действия',
    diagram: () => `${rect(827, 274, 553, 501, C.pale, 'none', 24)}${text(871, 344, 'Охрана труда', 39, C.ink, 700)}${text(871, 396, 'Организация безопасной работы', 27, C.muted)}${rect(873, 446, 461, 274, C.ink, 'none', 18)}${text(911, 510, 'Техника', 36, C.white, 700)}${text(911, 555, 'безопасности', 36, C.white, 700)}${line(911, 589, 1291, 589, '#5b8081')}${text(911, 633, 'Безопасные приёмы', 28, C.white)}${text(911, 675, 'и порядок действий', 28, C.white)}`,
  },
  {
    slug: 'instruktazhi-ohrana-truda-zhurnal-kazakhstan',
    title: ['Инструктажи:', 'учёт без пробелов'],
    subtitle: ['Как выбрать вид инструктажа', 'и оформить запись'],
    label: 'Вид • проведение • запись',
    diagram: () => `${rect(830, 274, 553, 501, C.white, C.rule)}${rect(830, 274, 553, 109, C.ink)}${text(877, 347, 'Журнал инструктажей', 35, C.white, 700)}${['Дата', 'Сотрудник', 'Вид'].map((value, index) => text([863, 1002, 1227][index], 435, value, 26, C.muted, 700)).join('')}${[464, 531, 598, 665, 732].map((y) => line(855, y, 1357, y)).join('')}${line(981, 405, 981, 733)}${line(1211, 405, 1211, 733)}${[501, 568, 635, 702].map((y, i) => `${line(868, y, 952, y, C.rule, 7)}${line(1004, y, 1175 - i * 9, y, C.rule, 7)}${check(1252, y - 4, C.teal, 0.7)}`).join('')}`,
  },
  {
    slug: 'plan-obucheniya-personala-2027',
    title: ['План обучения', 'персонала на 2027 год'],
    subtitle: ['Сотрудники, программы', 'и контрольные даты'],
    label: 'Матрица • график • бюджет',
    diagram: () => `${rect(831, 277, 546, 499, C.white, C.rule)}${rect(831, 277, 546, 103, C.ink)}${text(873, 349, '2027', 58, C.white, 700)}${[0, 1, 2, 3].map((i) => `${rect(858 + (i % 2) * 252, 413 + Math.floor(i / 2) * 170, 239, 148, i === 0 ? C.pale : '#edf1eb')}${text(881 + (i % 2) * 252, 457 + Math.floor(i / 2) * 170, `${i + 1} квартал`, 29, C.ink, 700)}${[0, 1, 2].map((j) => circle(889 + (i % 2) * 252 + j * 67, 513 + Math.floor(i / 2) * 170, 17, j === i % 3 ? C.teal : '#c6d6ca')).join('')}`).join('')}`,
  },
];

function render(cover) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024" viewBox="0 0 1536 1024" role="img" aria-labelledby="title description"><title id="title">${escape(cover.title.join(' '))}</title><desc id="description">Оригинальная редакционная схема OT Center. ${escape(cover.subtitle.join(' '))}.</desc>${rect(0, 0, 1536, 1024, C.paper, 'none', 0)}${rect(0, 0, 26, 1024, C.teal, 'none', 0)}${text(103, 146, 'OT Center', 45, C.ink, 700)}${text(1427, 144, 'Практика безопасной работы', 27, C.muted, 400, 'end')}${line(104, 191, 1427, 191, C.rule, 2)}${cover.title.map((value, index) => text(103, 382 + index * 73, value, value.length > 22 ? 48 : 53, C.ink, 700)).join('')}${cover.subtitle.map((value, index) => text(107, 550 + index * 48, value, 30, C.muted)).join('')}${rect(107, 649, 91, 6, C.teal, 'none', 0)}${text(107, 723, cover.label.split(' • ')[0], 28, C.teal, 700)}${text(107, 768, cover.label.split(' • ').slice(1).join(' • '), 28, C.teal)}${cover.diagram()}${line(104, 884, 1427, 884, C.rule, 2)}${text(104, 941, 'Казахстан', 29, C.ink, 700)}${text(1427, 941, 'otcenter.kz', 28, C.muted, 400, 'end')}</svg>`;
}

await fs.mkdir(target, { recursive: true });
const previews = [];
for (const cover of covers) {
  const svg = render(cover);
  const source = path.join(target, `${cover.slug}.svg`);
  const output = path.join(target, `${cover.slug}.webp`);
  await fs.writeFile(source, svg, 'utf8');
  await sharp(Buffer.from(svg)).webp({ quality: 93, effort: 6 }).toFile(output);
  const metadata = await sharp(output).metadata();
  if (metadata.width !== 1536 || metadata.height !== 1024 || metadata.format !== 'webp') throw new Error(`Invalid cover: ${cover.slug}`);
  previews.push(await sharp(output).resize(576, 384).png().toBuffer());
  console.log(`${cover.slug}: ${metadata.width}x${metadata.height}, ${Math.round((await fs.stat(output)).size / 1024)} KiB`);
}
const previewPath = path.join(root, '.output/seo/blog-covers-20260929.png');
await fs.mkdir(path.dirname(previewPath), { recursive: true });
await sharp({ create: { width: 1152, height: 1920, channels: 3, background: C.rule } })
  .composite(previews.map((input, index) => ({ input, left: (index % 2) * 576, top: Math.floor(index / 2) * 384 })))
  .png().toFile(previewPath);
console.log(`Preview: ${previewPath}`);
