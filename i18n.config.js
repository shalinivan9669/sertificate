export default defineI18nConfig(() => ({
  legacy: false,
  locale: 'ru',
  fallbackLocale: 'ru',
  messages: {
    ru: {
      language: 'Русский',
      nav: {
        home: 'Главная',
        courses: 'Курсы',
        formats: 'Форматы обучения',
        blog: 'Блог',
        contacts: 'Контакты',
        cities: 'Города',
      },
      cta: {
        apply: 'Оставить заявку',
        viewCourses: 'Посмотреть курсы',
      },
    },
    kk: {
      language: 'Қазақша',
      nav: {
        home: 'Басты бет',
        courses: 'Курстар',
        formats: 'Оқыту форматтары',
        blog: 'Блог',
        contacts: 'Байланыс',
        cities: 'Қалалар',
      },
      cta: {
        apply: 'Өтінім қалдыру',
        viewCourses: 'Курстарды көру',
      },
    },
  },
  datetimeFormats: {
    ru: { short: { year: 'numeric', month: 'short', day: 'numeric' } },
    kk: { short: { year: 'numeric', month: 'short', day: 'numeric' } },
  },
}));
