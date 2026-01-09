<script setup>
import { computed } from 'vue';
import { useI18n, useLocalePath } from '#imports';
import { getSortedBlogPosts } from '~/config/blog';
import { cities } from '~/config/cities';
import { getCityName, getCityPrepositional } from '~/composables/useCity';

const props = defineProps({
  city: {
    type: [Object, null],
    default: null,
  },
});

const resolvedCity = computed(() =>
  props.city && 'value' in props.city ? props.city.value : props.city,
);
const { locale, t, tm } = useI18n();
const localePath = useLocalePath();
const cityPrepositional = computed(() =>
  resolvedCity.value ? getCityPrepositional(resolvedCity.value, locale.value) : null,
);

const directions = [
  { title: 'Охрана труда', slug: 'ohrana-truda', description: 'Требования охраны труда и ответственность руководителей.' },
  { title: 'Промышленная безопасность', slug: 'promyshlennaya-bezopasnost', description: 'Безопасная эксплуатация производственных объектов и оборудования.' },
  { title: 'Пожарно-технический минимум (ПТМ)', slug: 'ptm', description: 'Действия персонала при пожаре, инструкции и эвакуация.' },
  { title: 'Электробезопасность', slug: 'elektrobezopasnost', description: 'Группы допуска IV/V, оформление наряд-допусков, первая помощь.' },
  { title: 'Работы на высоте', slug: 'raboty-na-vysote', description: 'СИЗ, работа на лестницах и лесах, спасение пострадавших.' },
  { title: 'ГПМ / стропальщики', slug: 'gpm-stropalschiki', description: 'Строповка, сигналы, устойчивость груза и контроль.' },
  { title: 'Газоопасные работы', slug: 'gazoopasnye-raboty', description: 'Наряды-допуски, контроль атмосферы, действия при ЧС.' },
  { title: 'Экологическая безопасность', slug: 'ekologicheskaya-bezopasnost', description: 'Отчётность, выбросы, обращение с отходами.' },
  { title: 'Первая помощь', slug: 'pervaya-pomoshch', description: 'Базовые алгоритмы, СЛР, остановка кровотечения.' },
];

const formatCards = [
  { title: 'Очное обучение', slug: 'ochnoe-obuchenie', description: 'Занятия в классе, практика, экзамен на месте.' },
  { title: 'Онлайн', slug: 'online-obuchenie', description: 'Дистанционно из любого города Казахстана.' },
  { title: 'Выездное', slug: 'vyezdnoe-obuchenie', description: 'Преподаватель приезжает на ваш объект.' },
  { title: 'Срочное', slug: 'srochnoe-obuchenie', description: 'Быстрое оформление документов и допусков.' },
  { title: 'Для тендера', slug: 'obuchenie-dlya-tendera', description: 'Готовим персонал и пакеты документов под тендер.' },
  { title: 'Продление удостоверений', slug: 'prodlenie-udostovereniy', description: 'Актуализация знаний и выдача новых удостоверений.' },
];

const asList = (value) => (Array.isArray(value) ? value : []);
const seoFormats = computed(() => asList(tm('home.seoFormats')));
const seoRoles = computed(() => asList(tm('home.seoRoles')));
const seoSynonyms = computed(() => asList(tm('home.seoSynonyms')));

const heroTitle = computed(() =>
  cityPrepositional.value
    ? t('home.heroTitleCity', { city: cityPrepositional.value })
    : t('home.heroTitleDefault'),
);

const withCityPath = (slug) => {
  const base = resolvedCity.value?.slug ? `/${resolvedCity.value.slug}/${slug}` : `/${slug}`;
  return localePath(base);
};

const blogArticles = computed(() => getSortedBlogPosts().slice(0, 4));
</script>

<template>
  <div class="space-y-16">
    <section class="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 md:p-10">
      <div class="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div class="space-y-4 max-w-3xl">
          <p class="text-sm uppercase tracking-wide text-brand-accent font-semibold">
            {{ t('home.heroBadge') }}
          </p>
          <h1 class="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
            {{ heroTitle }}
          </h1>
          <p class="text-lg text-slate-700">
            {{ t('home.heroDescription') }}
          </p>
          <div class="flex flex-wrap gap-3">
            <a class="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-brand-accent text-white font-semibold hover:bg-emerald-700 transition" href="#contact">{{ t('cta.apply') }}</a>
            <a class="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-slate-200 text-brand font-semibold hover:border-brand hover:text-brand transition" href="#courses">{{ t('cta.viewCourses') }}</a>
          </div>
        </div>
        <div class="hidden md:block w-64 h-40 rounded-xl bg-gradient-to-br from-brand-soft to-white border border-slate-200" />
      </div>
    </section>

    <section id="courses" class="space-y-6">
      <header class="space-y-2">
        <p class="text-sm font-semibold text-brand-accent">Направления обучения</p>
        <h2 class="text-2xl font-bold text-slate-900">Ключевые курсы</h2>
        <p class="text-slate-700">Подготовка персонала с учётом требований законодательства и отраслевых стандартов.</p>
      </header>
      <div class="grid gap-4 md:grid-cols-3">
        <NuxtLink
          v-for="direction in directions"
          :key="direction.slug"
          :to="withCityPath(direction.slug)"
          class="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition"
        >
          <h3 class="text-lg font-semibold text-slate-900 group-hover:text-brand">{{ direction.title }}</h3>
          <p class="mt-2 text-sm text-slate-700">{{ direction.description }}</p>
        </NuxtLink>
      </div>
    </section>

    <section id="formats" class="space-y-6">
      <header class="space-y-2">
        <p class="text-sm font-semibold text-brand-accent">Форматы</p>
        <h2 class="text-2xl font-bold text-slate-900">Форматы обучения</h2>
        <p class="text-slate-700">Подберём удобный формат под график, территорию и задачи вашего предприятия.</p>
      </header>
      <div class="grid gap-4 md:grid-cols-3">
        <NuxtLink
          v-for="format in formatCards"
          :key="format.slug"
          :to="withCityPath(format.slug)"
          class="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition"
        >
          <h3 class="text-lg font-semibold text-slate-900 group-hover:text-brand">{{ format.title }}</h3>
          <p class="mt-2 text-sm text-slate-700">{{ format.description }}</p>
        </NuxtLink>
      </div>
    </section>

    <section class="space-y-4">
      <header class="space-y-2">
        <p class="text-sm font-semibold text-brand-accent">Почему мы</p>
        <h2 class="text-2xl font-bold text-slate-900">Почему выбирают нас</h2>
      </header>
      <div class="grid gap-3 md:grid-cols-2">
        <div class="rounded-lg border border-slate-200 bg-white p-4 text-slate-700">Лицензия и опыт преподавателей. Программы по требованиям ТК и отраслевых стандартов.</div>
        <div class="rounded-lg border border-slate-200 bg-white p-4 text-slate-700">Срочные группы, онлайн и выезд по Казахстану. Поддержка на всех этапах.</div>
        <div class="rounded-lg border border-slate-200 bg-white p-4 text-slate-700">Документы: удостоверения, протоколы, приказы. Готовность к проверкам.</div>
        <div class="rounded-lg border border-slate-200 bg-white p-4 text-slate-700">Гибкое расписание под график производства и смен.</div>
        <div class="rounded-lg border border-slate-200 bg-white p-4 text-slate-700">Консультации по требованиям заказчиков и тендеров.</div>
      </div>
    </section>

    <section class="space-y-4">
      <header class="space-y-2">
        <p class="text-sm font-semibold text-brand-accent">Лицензии</p>
        <h2 class="text-2xl font-bold text-slate-900">Лицензии и сертификаты</h2>
        <p class="text-slate-700">Готовы предоставить копии лицензии, аккредитации и документов по запросу.</p>
      </header>
      <div class="grid gap-4 sm:grid-cols-3">
        <div class="h-28 rounded-xl border border-dashed border-slate-300 bg-white flex items-center justify-center text-slate-500">Лицензия</div>
        <div class="h-28 rounded-xl border border-dashed border-slate-300 bg-white flex items-center justify-center text-slate-500">Сертификат</div>
        <div class="h-28 rounded-xl border border-dashed border-slate-300 bg-white flex items-center justify-center text-slate-500">Аккредитация</div>
      </div>
    </section>

    <section class="space-y-4">
      <header class="space-y-2">
        <p class="text-sm font-semibold text-brand-accent">Отзывы</p>
        <h2 class="text-2xl font-bold text-slate-900">Отзывы и клиенты</h2>
      </header>
      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 class="font-semibold text-slate-900">Опыт и экспертиза</h3>
          <p class="mt-2 text-slate-700">Работаем с крупными предприятиями, готовим персонал под требования заказчиков и проверок.</p>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 class="font-semibold text-slate-900">Широкая география</h3>
          <p class="mt-2 text-slate-700">Проводим обучение по всей Республике Казахстан: онлайн, очно и на выезде.</p>
        </div>
      </div>
    </section>

    <section class="space-y-4">
      <header class="space-y-2">
        <p class="text-sm font-semibold text-brand-accent">Статьи</p>
        <h2 class="text-2xl font-bold text-slate-900">Полезные материалы</h2>
      </header>
      <div class="grid gap-4 md:grid-cols-2">
        <article
          v-for="post in blogArticles || []"
          :key="post._path"
          class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <header class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-slate-900">
              <NuxtLink :to="localePath(post._path)" class="hover:text-brand">{{ post.title }}</NuxtLink>
            </h3>
            <time :datetime="post.date" class="text-xs text-slate-500">{{ post.date }}</time>
          </header>
          <p class="mt-2 text-sm text-slate-700">{{ post.description }}</p>
        </article>
        <p v-if="!blogArticles || blogArticles.length === 0" class="text-slate-600 col-span-full">Публикации появятся скоро.</p>
      </div>
    </section>


    <section class="space-y-6" id="seo">
      <header class="space-y-2">
        <h2 class="text-2xl font-bold text-slate-900">{{ t('home.seoTitle') }}</h2>
        <p class="text-slate-700">{{ t('home.seoDescription') }}</p>
      </header>
      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-lg border border-slate-200 bg-white p-4 text-slate-700">
          <h3 class="font-semibold text-slate-900">{{ t('home.seoFormatsTitle') }}</h3>
          <ul class="mt-2 grid gap-2 list-disc ml-4">
            <li v-for="item in seoFormats" :key="item">{{ item }}</li>
          </ul>
        </div>
        <div class="rounded-lg border border-slate-200 bg-white p-4 text-slate-700">
          <h3 class="font-semibold text-slate-900">{{ t('home.seoRolesTitle') }}</h3>
          <ul class="mt-2 grid gap-2 list-disc ml-4">
            <li v-for="item in seoRoles" :key="item">{{ item }}</li>
          </ul>
        </div>
        <div class="rounded-lg border border-slate-200 bg-white p-4 text-slate-700 md:col-span-2">
          <h3 class="font-semibold text-slate-900">{{ t('home.seoSynonymsTitle') }}</h3>
          <ul class="mt-2 grid gap-2 list-disc ml-4">
            <li v-for="item in seoSynonyms" :key="item">{{ item }}</li>
          </ul>
        </div>
      </div>
    </section>

    <section class="space-y-4" id="cities">
      <header class="space-y-2">
        <p class="text-sm font-semibold text-brand-accent">{{ t('nav.cities') }}</p>
        <h2 class="text-2xl font-bold text-slate-900">{{ t('home.seoGeoTitle') }}</h2>
        <p class="text-slate-700">{{ t('home.seoGeoDescription') }}</p>
      </header>
      <div class="flex flex-wrap gap-2">
        <NuxtLink
          v-for="city in cities"
          :key="city.slug"
          :to="localePath(`/${city.slug}`)"
          class="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700 hover:border-brand hover:text-brand transition"
        >
          {{ getCityName(city, locale) }}
        </NuxtLink>
      </div>
    </section>

    <section id="contact" class="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center space-y-3">
      <p class="text-sm font-semibold text-brand-accent">Готовы обсудить</p>
      <h2 class="text-2xl font-bold text-slate-900">Получите консультацию по обучению</h2>
      <p class="text-slate-700">Оставьте заявку, чтобы подобрать программу и формат под вашу компанию.</p>
      <div class="flex justify-center gap-3">
        <NuxtLink :to="localePath('/contacts')" class="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-brand-accent text-white font-semibold hover:bg-emerald-700 transition">{{ t('cta.apply') }}</NuxtLink>
        <a class="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-slate-200 text-brand font-semibold hover:border-brand hover:text-brand transition" href="tel:+77000000000">{{ t('cta.call') }}</a>
      </div>
    </section>
  </div>
</template>
