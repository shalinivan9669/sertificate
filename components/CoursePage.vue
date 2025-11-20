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
  <article class="space-y-10">
    <header class="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-4">
      <p class="text-sm font-semibold text-brand-accent uppercase tracking-wide">Курс</p>
      <h1 class="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">{{ courseName }}</h1>
      <p class="text-lg text-slate-700">
        {{ metaDescription }}
      </p>
      <div class="flex flex-wrap gap-3 text-sm text-slate-700">
        <span class="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 border border-slate-200">
          <strong class="font-semibold text-slate-900">Длительность:</strong> {{ course.durationHours }} часов
        </span>
        <span class="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 border border-slate-200">
          <strong class="font-semibold text-slate-900">Обязан по закону:</strong>
          {{ course.mandatoryByLaw ? 'Да' : 'По согласованию / для повышения квалификации' }}
        </span>
        <span class="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 border border-slate-200">
          <strong class="font-semibold text-slate-900">Город:</strong>
          {{ resolvedCity?.nameRu || 'Казахстан' }}
        </span>
      </div>
    </header>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
      <h2 class="text-xl font-semibold text-slate-900">Кому необходимо обучение</h2>
      <ul class="grid gap-2 text-slate-700">
        <li>Руководители и специалисты, ответственные за безопасность работ.</li>
        <li>Линейный персонал и рабочие, задействованные в опасных процессах.</li>
        <li>Инженеры охраны труда и специалисты по промышленной безопасности.</li>
        <li>Сотрудники подрядных организаций и временного персонала.</li>
      </ul>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
      <h2 class="text-xl font-semibold text-slate-900">Программа курса</h2>
      <ContentRenderer v-if="contentDoc" :value="contentDoc" class="prose max-w-none prose-slate" />
      <div v-else class="text-slate-700">
        Подробная программа курса будет опубликована в ближайшее время.
      </div>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
      <h2 class="text-xl font-semibold text-slate-900">Форматы обучения</h2>
      <ul class="grid gap-2 text-slate-700">
        <li>Очные занятия в учебном центре.</li>
        <li>Онлайн-трансляции с консультациями преподавателя.</li>
        <li>Выезд на предприятие с учетом специфики площадки {{ cityPrepositional }}.</li>
        <li>Сжатые сроки и индивидуальные графики для срочных запросов.</li>
      </ul>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
      <h2 class="text-xl font-semibold text-slate-900">Итоговая аттестация и удостоверение</h2>
      <p class="text-slate-700">
        По завершении курса слушатели проходят проверку знаний и получают удостоверение государственного образца
        и протокол экзаменационной комиссии.
      </p>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <h2 class="text-xl font-semibold text-slate-900">Стоимость обучения</h2>
      <p class="text-slate-700">Стоимость зависит от формата и количества слушателей. Оставьте заявку, чтобы получить расчёт.</p>
      <div class="flex flex-wrap gap-3">
        <a class="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-brand-accent text-white font-semibold hover:bg-emerald-700 transition" href="#contact">Узнать стоимость</a>
        <a class="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-slate-200 text-brand font-semibold hover:border-brand hover:text-brand transition" href="tel:+77000000000">Позвонить</a>
      </div>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
      <h2 class="text-xl font-semibold text-slate-900">Почему выбирают наш центр</h2>
      <ul class="grid gap-2 text-slate-700">
        <li>Работаем по лицензии, программы соответствуют требованиям законодательства.</li>
        <li>Преподаватели — практики с опытом внедрения систем безопасности.</li>
        <li>Готовим полный пакет документов для проверок и тендеров.</li>
        <li>Покрываем обучение по всей территории Казахстана.</li>
      </ul>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
      <h2 class="text-xl font-semibold text-slate-900">FAQ по курсу</h2>
      <div class="divide-y divide-slate-200">
        <details class="py-3">
          <summary class="cursor-pointer font-semibold text-slate-900">Можно ли пройти обучение онлайн?</summary>
          <p class="mt-2 text-slate-700">Да, курс доступен в формате онлайн с последующей аттестацией.</p>
        </details>
        <details class="py-3">
          <summary class="cursor-pointer font-semibold text-slate-900">Какие документы выдаются?</summary>
          <p class="mt-2 text-slate-700">Удостоверение гос. образца и протокол проверки знаний.</p>
        </details>
        <details class="py-3">
          <summary class="cursor-pointer font-semibold text-slate-900">Сколько длится обучение?</summary>
          <p class="mt-2 text-slate-700">Средняя длительность — {{ course.durationHours }} часов, можно адаптировать под запрос.</p>
        </details>
      </div>
    </section>
  </article>
</template>
