<script setup>
import { computed } from 'vue';
import { useHead, useI18n } from '#imports';

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
const cityName = computed(() => resolvedCity.value?.nameRu || 'любой город');
const cityPrepositional = computed(
  () => resolvedCity.value?.nameRuPrepositional || 'в любом городе',
);

const fillTemplate = (template) =>
  template
    .replaceAll('{{city}}', cityName.value)
    .replaceAll('{{cityPrepositional}}', cityPrepositional.value);

const metaTitle = computed(() => fillTemplate(props.course.seo?.title || courseName.value));
const metaDescription = computed(() =>
  fillTemplate(
    props.course.seo?.description ||
      `Обучение «${courseName.value}» ${cityPrepositional.value}: программа, требования, выдача удостоверений.`,
  ),
);

const courseContentHtml = computed(() => props.course.contentHtml || '');

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
          <strong class="font-semibold text-slate-900">Длительность:</strong> {{ course.durationHours }} акад. часов
        </span>
        <span class="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 border border-slate-200">
          <strong class="font-semibold text-slate-900">Обязательность:</strong>
          {{ course.mandatoryByLaw ? 'Требуется по законодательству' : 'По запросу компании' }}
        </span>
        <span class="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 border border-slate-200">
          <strong class="font-semibold text-slate-900">Город:</strong>
          {{ resolvedCity?.nameRu || 'Любой регион' }}
        </span>
      </div>
    </header>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
      <h2 class="text-xl font-semibold text-slate-900">Что разберём на курсе</h2>
      <ul class="grid gap-2 text-slate-700 list-disc ml-4">
        <li>Нормативные требования и ответственность работодателя.</li>
        <li>Практика безопасной работы и алгоритмы действий в нештатных ситуациях.</li>
        <li>Документирование обучения и подготовка к проверкам.</li>
        <li>Ответы на вопросы сотрудников и разбор кейсов из вашей отрасли.</li>
      </ul>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
      <h2 class="text-xl font-semibold text-slate-900">Программа курса</h2>
      <div v-if="courseContentHtml" class="prose max-w-none prose-slate" v-html="courseContentHtml" />
      <div v-else class="text-slate-700">
        Программа скоро появится в онлайн-формате. Если нужен подробный план прямо сейчас, напишите нам — отправим
        расписание и содержание модулей.
      </div>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
      <h2 class="text-xl font-semibold text-slate-900">Выгоды для компании</h2>
      <ul class="grid gap-2 text-slate-700 list-disc ml-4">
        <li>Снижаете штрафные риски и упорядочиваете документы.</li>
        <li>Повышаете осознанность сотрудников в вопросах безопасности.</li>
        <li>Минимизируете простои за счёт готовых чек-листов и регламентов.</li>
        <li>Получаете консультации по адаптации программы под ваши условия {{ cityPrepositional }}.</li>
      </ul>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
      <h2 class="text-xl font-semibold text-slate-900">Как проходит обучение</h2>
      <p class="text-slate-700">
        Теория и практика идут блоками: дистанционно или очно, по удобному графику. По завершении — тестирование и
        оформление удостоверений, протоколов комиссии и приказов.
      </p>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <h2 class="text-xl font-semibold text-slate-900">Записаться на обучение</h2>
      <p class="text-slate-700">
        Первая консультация бесплатна: подберём формат, согласуем график, подготовим пакет документов.
      </p>
      <div class="flex flex-wrap gap-3">
        <a class="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-brand-accent text-white font-semibold hover:bg-emerald-700 transition" href="#contact">Получить консультацию</a>
        <a class="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-slate-200 text-brand font-semibold hover:border-brand hover:text-brand transition" href="tel:+77000000000">Позвонить</a>
      </div>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
      <h2 class="text-xl font-semibold text-slate-900">Почему выбирают нас</h2>
      <ul class="grid gap-2 text-slate-700 list-disc ml-4">
        <li>Работаем по всей стране, организуем выездные и онлайн-группы.</li>
        <li>Преподаватели с практическим опытом и актуальными методиками.</li>
        <li>Готовые шаблоны приказов, журналы и чек-листы.</li>
        <li>Помогаем подготовиться к проверкам и аудиту.</li>
      </ul>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
      <h2 class="text-xl font-semibold text-slate-900">FAQ</h2>
      <div class="divide-y divide-slate-200">
        <details class="py-3">
          <summary class="cursor-pointer font-semibold text-slate-900">Можно ли обучаться онлайн?</summary>
          <p class="mt-2 text-slate-700">
            Да, все лекции и тесты доступны дистанционно. Практика и итоговая проверка проходят в удобном формате по
            согласованию.
          </p>
        </details>
        <details class="py-3">
          <summary class="cursor-pointer font-semibold text-slate-900">Сколько длится курс?</summary>
          <p class="mt-2 text-slate-700">
            Средняя продолжительность — {{ course.durationHours }} академических часов. График можем уплотнить или
            разбить на несколько недель.
          </p>
        </details>
        <details class="py-3">
          <summary class="cursor-pointer font-semibold text-slate-900">Когда выдаётся удостоверение?</summary>
          <p class="mt-2 text-slate-700">
            Сразу после успешного тестирования и оформления протокола комиссии. Документы высылаем в электронном
            виде и передаём оригиналы.
          </p>
        </details>
      </div>
    </section>
  </article>
</template>
