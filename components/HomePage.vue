<script setup>
import { computed } from 'vue';
import { useAsyncData } from '#imports';

const props = defineProps({
  city: {
    type: [Object, null],
    default: null,
  },
});

const resolvedCity = computed(() =>
  props.city && 'value' in props.city ? props.city.value : props.city,
);

const directions = [
  { title: 'Охрана труда', slug: 'ohrana-truda' },
  { title: 'Промышленная безопасность', slug: 'promyshlennaya-bezopasnost' },
  { title: 'ПТМ', slug: 'ptm' },
  { title: 'Электробезопасность', slug: 'elektrobezopasnost' },
  { title: 'Работы на высоте', slug: 'raboty-na-vysote' },
  { title: 'ГПМ (стропальщики)', slug: 'gpm-stropalschiki' },
  { title: 'Газоопасные работы', slug: 'gazoopasnye-raboty' },
  { title: 'Экология и ООС', slug: 'ekologicheskaya-bezopasnost' },
  { title: 'Первая помощь', slug: 'pervaya-pomoshch' },
];

const formatCards = [
  { title: 'Очное обучение', slug: 'ochnoe-obuchenie' },
  { title: 'Онлайн обучение', slug: 'online-obuchenie' },
  { title: 'Выездное обучение', slug: 'vyezdnoe-obuchenie' },
  { title: 'Срочное обучение', slug: 'srochnoe-obuchenie' },
  { title: 'Для тендера', slug: 'obuchenie-dlya-tendera' },
  { title: 'Продление удостоверений', slug: 'prodlenie-udostovereniy' },
];

const heroTitle = computed(() =>
  resolvedCity.value
    ? `Учебный центр по охране труда и промышленной безопасности ${resolvedCity.value.nameRuPrepositional}`
    : 'Учебный центр по охране труда и промышленной безопасности в Казахстане',
);

const withCityPath = (slug) => {
  const prefix = resolvedCity.value?.slug ? `/${resolvedCity.value.slug}` : '';
  return `${prefix}/${slug}`;
};

const { data: blogArticles } = await useAsyncData('home-blog', async () => {
  const res = await $fetch('/api/_content/query', {
    method: 'POST',
    body: {
      where: { _path: { $regex: '^/blog' } },
      sort: [{ date: -1 }],
      limit: 4,
    },
  });
  return res?.data || [];
});
</script>

<template>
  <div class="space-y-16">
    <section class="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 md:p-10">
      <div class="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div class="space-y-4 max-w-3xl">
          <p class="text-sm uppercase tracking-wide text-brand-accent font-semibold">
            Лицензированный учебный центр
          </p>
          <h1 class="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
            {{ heroTitle }}
          </h1>
          <p class="text-lg text-slate-700">
            Обучение по охране труда, промышленной безопасности, ПТМ, электробезопасности. Онлайн, очно и выездно.
            Удостоверения государственного образца.
          </p>
          <div class="flex flex-wrap gap-3">
            <a class="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-brand-accent text-white font-semibold hover:bg-emerald-700 transition" href="#contact">Оставить заявку</a>
            <a class="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-slate-200 text-brand font-semibold hover:border-brand hover:text-brand transition" href="#courses">Посмотреть курсы</a>
          </div>
        </div>
        <div class="hidden md:block w-64 h-40 rounded-xl bg-gradient-to-br from-brand-soft to-white border border-slate-200" />
      </div>
    </section>

    <section id="courses" class="space-y-6">
      <header class="space-y-2">
        <p class="text-sm font-semibold text-brand-accent">Программы</p>
        <h2 class="text-2xl font-bold text-slate-900">Направления обучения</h2>
        <p class="text-slate-700">Покрываем ключевые отраслевые требования по безопасности труда и промышленности.</p>
      </header>
      <div class="grid gap-4 md:grid-cols-3">
        <NuxtLink
          v-for="direction in directions"
          :key="direction.slug"
          :to="withCityPath(direction.slug)"
          class="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition"
        >
          <h3 class="text-lg font-semibold text-slate-900 group-hover:text-brand">{{ direction.title }}</h3>
          <p class="mt-2 text-sm text-slate-700">Программа, соответствующая требованиям законодательства и отраслевым стандартам.</p>
        </NuxtLink>
      </div>
    </section>

    <section id="formats" class="space-y-6">
      <header class="space-y-2">
        <p class="text-sm font-semibold text-brand-accent">Форматы</p>
        <h2 class="text-2xl font-bold text-slate-900">Форматы обучения</h2>
        <p class="text-slate-700">Подбираем удобный формат под график, территорию и задачи вашего предприятия.</p>
      </header>
      <div class="grid gap-4 md:grid-cols-3">
        <NuxtLink
          v-for="format in formatCards"
          :key="format.slug"
          :to="withCityPath(format.slug)"
          class="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition"
        >
          <h3 class="text-lg font-semibold text-slate-900 group-hover:text-brand">{{ format.title }}</h3>
          <p class="mt-2 text-sm text-slate-700">Организуем обучение в нужные сроки с официальной отчетностью и документами.</p>
        </NuxtLink>
      </div>
    </section>

    <section class="space-y-4">
      <header class="space-y-2">
        <p class="text-sm font-semibold text-brand-accent">Почему мы</p>
        <h2 class="text-2xl font-bold text-slate-900">Почему выбирают нас</h2>
      </header>
      <div class="grid gap-3 md:grid-cols-2">
        <div class="rounded-lg border border-slate-200 bg-white p-4 text-slate-700">Государственная лицензия и аккредитации по ключевым направлениям.</div>
        <div class="rounded-lg border border-slate-200 bg-white p-4 text-slate-700">Преподаватели-практики с опытом внедрения систем безопасности на производствах.</div>
        <div class="rounded-lg border border-slate-200 bg-white p-4 text-slate-700">Срочные программы и обучение в удобные для клиента сроки.</div>
        <div class="rounded-lg border border-slate-200 bg-white p-4 text-slate-700">Онлайн, очные и выездные форматы по всей территории Казахстана.</div>
        <div class="rounded-lg border border-slate-200 bg-white p-4 text-slate-700">Полный пакет документов для проверок, тендеров и внутренних регламентов.</div>
      </div>
    </section>

    <section class="space-y-4">
      <header class="space-y-2">
        <p class="text-sm font-semibold text-brand-accent">Документы</p>
        <h2 class="text-2xl font-bold text-slate-900">Лицензии и сертификаты</h2>
        <p class="text-slate-700">Скан-копии и реквизиты — по запросу или в открытом доступе.</p>
      </header>
      <div class="grid gap-4 sm:grid-cols-3">
        <div class="h-28 rounded-xl border border-dashed border-slate-300 bg-white flex items-center justify-center text-slate-500">Лицензия</div>
        <div class="h-28 rounded-xl border border-dashed border-slate-300 bg-white flex items-center justify-center text-slate-500">Аккредитация</div>
        <div class="h-28 rounded-xl border border-dashed border-slate-300 bg-white flex items-center justify-center text-slate-500">Сертификат</div>
      </div>
    </section>

    <section class="space-y-4">
      <header class="space-y-2">
        <p class="text-sm font-semibold text-brand-accent">Отзывы</p>
        <h2 class="text-2xl font-bold text-slate-900">Отзывы и клиенты</h2>
      </header>
      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 class="font-semibold text-slate-900">АО «Промышленность»</h3>
          <p class="mt-2 text-slate-700">«Организовали срочное обучение персонала под тендер — все документы подошли контролерам».</p>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 class="font-semibold text-slate-900">ТОО «Энергия»</h3>
          <p class="mt-2 text-slate-700">«Удобные онлайн-сессии и выездная аттестация на площадке. Закрыли требования по ОТ и ПБ».</p>
        </div>
      </div>
    </section>

    <section class="space-y-4">
      <header class="space-y-2">
        <p class="text-sm font-semibold text-brand-accent">Блог</p>
        <h2 class="text-2xl font-bold text-slate-900">Полезные материалы</h2>
        <p class="text-slate-700">Свежие разъяснения по требованиям надзора и подготовке к проверкам.</p>
      </header>
      <div class="grid gap-4 md:grid-cols-2">
        <article
          v-for="post in blogArticles || []"
          :key="post._path"
          class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <header class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-slate-900">
              <NuxtLink :to="post._path" class="hover:text-brand">{{ post.title }}</NuxtLink>
            </h3>
            <time :datetime="post.date" class="text-xs text-slate-500">{{ post.date }}</time>
          </header>
          <p class="mt-2 text-sm text-slate-700">{{ post.description }}</p>
        </article>
        <p v-if="!blogArticles || blogArticles.length === 0" class="text-slate-600 col-span-full">Статьи появятся совсем скоро.</p>
      </div>
    </section>

    <section id="contact" class="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center space-y-3">
      <p class="text-sm font-semibold text-brand-accent">Свяжитесь с нами</p>
      <h2 class="text-2xl font-bold text-slate-900">Готовы обсудить обучение</h2>
      <p class="text-slate-700">Оставьте заявку — подберем программу и формат под ваш запрос.</p>
      <div class="flex justify-center gap-3">
        <a class="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-brand-accent text-white font-semibold hover:bg-emerald-700 transition" href="/contacts">Оставить заявку</a>
        <a class="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-slate-200 text-brand font-semibold hover:border-brand hover:text-brand transition" href="tel:+77000000000">Позвонить</a>
      </div>
    </section>
  </div>
</template>
