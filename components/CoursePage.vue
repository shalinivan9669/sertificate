<script setup>
import { computed } from 'vue';
import { useAsyncData, useHead, useI18n } from '#imports';
import { courses } from '~/config/courses';

const props = defineProps({
  course: {
    type: Object,
    required: true,
  },
  city: {
    type: [Object, null],
    default: null,
  },
});

const resolvedCity = computed(() =>
  props.city && 'value' in props.city ? props.city.value : props.city,
);

const { locale } = useI18n();
const courseName = computed(() => props.course.name[locale.value] || props.course.name.ru);
const cityName = computed(() => resolvedCity.value?.nameRu || 'Казахстан');
const cityPrepositional = computed(
  () => resolvedCity.value?.nameRuPrepositional || 'в Казахстане',
);

const fillTemplate = (template) =>
  template
    .replaceAll('{{city}}', cityName.value)
    .replaceAll('{{cityPrepositional}}', cityPrepositional.value);

const metaTitle = computed(() => fillTemplate(props.course.seo?.title || courseName.value));
const metaDescription = computed(() =>
  fillTemplate(
    props.course.seo?.description ||
      `Курс ${courseName.value} ${cityPrepositional.value}: обучение, удостоверения, официальные программы.`,
  ),
);

const slug = computed(() => props.course.slug);

const { data: contentDoc } = await useAsyncData(
  () => `course-content-${slug.value}-${locale.value}`,
  async () => {
    const query = async (loc) =>
      $fetch('/api/_content/query', {
        method: 'POST',
        body: {
          where: { _path: `/courses/${slug.value}.${loc}` },
          limit: 1,
        },
      });

    const current = await query(locale.value);
    if (current?.data?.length) return current.data[0];
    const fallback = await query('ru');
    return fallback?.data?.[0] || null;
  },
  { watch: [slug, locale] },
);

useHead(() => ({
  title: metaTitle.value,
  meta: [
    { name: 'description', content: metaDescription.value },
    { property: 'og:title', content: metaTitle.value },
    { property: 'og:description', content: metaDescription.value },
    { property: 'og:type', content: 'article' },
  ],
  script: [
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Course',
        name: courseName.value,
        description: metaDescription.value,
        provider: {
          '@type': 'EducationalOrganization',
          name: 'Учебный центр по охране труда и промышленной безопасности',
          url: 'https://example.kz',
        },
        areaServed: resolvedCity.value
          ? [
              {
                '@type': 'City',
                name: resolvedCity.value.nameRu,
              },
            ]
          : [
              {
                '@type': 'Country',
                name: 'Kazakhstan',
              },
            ],
      }),
    },
  ],
}));
</script>

<template>
  <article class="course-page">
    <header class="course-hero">
      <h1>{{ courseName }}</h1>
      <p class="lead">
        {{ metaDescription }}
      </p>
      <div class="course-meta">
        <span><strong>Длительность:</strong> {{ course.durationHours }} часов</span>
        <span>
          <strong>Обязан по закону:</strong>
          {{ course.mandatoryByLaw ? 'Да' : 'По согласованию / для повышения квалификации' }}
        </span>
      </div>
    </header>

    <section class="section">
      <h2>Кому необходимо обучение</h2>
      <ul class="list">
        <li>Руководители и специалисты, ответственные за безопасность работ.</li>
        <li>Линейный персонал и рабочие, задействованные в опасных процессах.</li>
        <li>Инженеры охраны труда и специалисты по промышленной безопасности.</li>
        <li>Сотрудники подрядных организаций и временного персонала.</li>
      </ul>
    </section>

    <section class="section">
      <h2>Программа курса</h2>
      <ContentRenderer v-if="contentDoc" :value="contentDoc" />
      <div v-else class="placeholder">
        Подробная программа курса будет опубликована в ближайшее время.
      </div>
    </section>

    <section class="section">
      <h2>Форматы обучения</h2>
      <ul class="list">
        <li>Очные занятия в учебном центре.</li>
        <li>Онлайн-трансляции с консультациями преподавателя.</li>
        <li>Выезд на предприятие с учетом специфики площадки {{ cityPrepositional }}.</li>
        <li>Сжатые сроки и индивидуальные графики для срочных запросов.</li>
      </ul>
    </section>

    <section class="section">
      <h2>Итоговая аттестация и удостоверение</h2>
      <p>
        По завершении курса слушатели проходят проверку знаний и получают удостоверение государственного образца
        и протокол экзаменационной комиссии.
      </p>
    </section>

    <section class="section">
      <h2>Стоимость обучения</h2>
      <p>Стоимость зависит от формата и количества слушателей. Оставьте заявку, чтобы получить расчёт.</p>
      <div class="cta__actions">
        <a class="btn primary" href="#contact">Узнать стоимость</a>
        <a class="btn ghost" href="tel:+77000000000">Позвонить</a>
      </div>
    </section>

    <section class="section">
      <h2>Почему выбирают наш центр</h2>
      <ul class="list">
        <li>Работаем по лицензии, программы соответствуют требованиям законодательства.</li>
        <li>Преподаватели — практики с опытом внедрения систем безопасности.</li>
        <li>Готовим полный пакет документов для проверок и тендеров.</li>
        <li>Покрываем обучение по всей территории Казахстана.</li>
      </ul>
    </section>

    <section class="section faq">
      <h2>FAQ по курсу</h2>
      <details>
        <summary>Можно ли пройти обучение онлайн?</summary>
        <p>Да, курс доступен в формате онлайн с последующей аттестацией.</p>
      </details>
      <details>
        <summary>Какие документы выдаются?</summary>
        <p>Удостоверение гос. образца и протокол проверки знаний.</p>
      </details>
      <details>
        <summary>Сколько длится обучение?</summary>
        <p>Средняя длительность — {{ course.durationHours }} часов, можно адаптировать под запрос.</p>
      </details>
    </section>
  </article>
</template>
