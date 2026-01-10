import type { LocalizedList, LocalizedText } from './cities';

export type CityCourseOverride = {
  heroTitle?: LocalizedText;
  heroDescription?: LocalizedText;
  extraNotes?: LocalizedList;
  relatedCourseSlugs?: string[];
};

const t = (ru: string, kk: string = ru): LocalizedText => ({ ru, kk });
const list = (ru: string[], kk: string[] = ru): LocalizedList => ({ ru, kk });

export const cityCourseOverrides: Record<string, CityCourseOverride> = {
  'almaty|ohrana-truda': {
    heroTitle: t('Охрана труда для складов и сервиса в Алматы'),
    heroDescription: t(
      'Акцент на логистике, сервисных командах и гибком графике обучения.',
    ),
    extraNotes: list([
      'Для распределенных филиалов в Алматы используем смешанный формат и единые стандарты.',
    ]),
  },
  'astana|promyshlennaya-bezopasnost': {
    heroTitle: t('Промышленная безопасность для подрядчиков Астаны'),
    heroDescription: t(
      'Упор на требования заказчиков, тендерные документы и быстрые сроки.',
    ),
    extraNotes: list([
      'Под ключ готовим пакет документов для участия в проектах и тендерах.',
    ]),
  },
  'atyrau|promyshlennaya-bezopasnost': {
    heroTitle: t('Промбезопасность для нефтегазовых проектов Атырау'),
    heroDescription: t(
      'Фокус на требованиях ОПО, допусках подрядчиков и проверке знаний.',
    ),
    extraNotes: list([
      'Учитываем вахтовые графики и пропускной режим промплощадок.',
    ]),
  },
  'karaganda|promyshlennaya-bezopasnost': {
    heroTitle: t('Промбезопасность для горнодобычи Караганды'),
    heroDescription: t(
      'Работаем с рисками добычи и металлургии, фиксируем допуски и протоколы.',
    ),
  },
  'aktau|gazoopasnye-raboty': {
    heroTitle: t('Газоопасные работы для портовых объектов Актау'),
    heroDescription: t(
      'Подготовка бригад к работам с повышенными рисками и нарядами-допусками.',
    ),
  },
  'shymkent|ptm': {
    heroTitle: t('ПТМ для производственных площадок Шымкента'),
    heroDescription: t(
      'Ставим практику по эвакуации и порядок действий для сменных цехов.',
    ),
  },
};
