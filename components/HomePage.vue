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
  <div class="home">
    <section class="hero">
      <div class="hero__content">
        <p class="eyebrow">Лицензированный учебный центр</p>
        <h1>{{ heroTitle }}</h1>
        <p class="hero__lead">
          Обучение по охране труда, промышленной безопасности, ПТМ, электробезопасности. Онлайн, очно и выездно.
          Удостоверения государственного образца.
        </p>
        <div class="hero__actions">
          <a class="btn primary" href="#contact">Оставить заявку</a>
          <a class="btn ghost" href="#courses">Посмотреть курсы</a>
        </div>
      </div>
    </section>

    <section id="courses" class="section">
      <header class="section__header">
        <h2>Направления обучения</h2>
        <p>Покрываем ключевые отраслевые требования по безопасности труда и промышленности.</p>
      </header>
      <div class="cards grid">
        <NuxtLink
          v-for="direction in directions"
          :key="direction.slug"
          :to="withCityPath(direction.slug)"
          class="card"
        >
          <h3>{{ direction.title }}</h3>
          <p>Программа, соответствующая требованиям законодательства и отраслевым стандартам.</p>
        </NuxtLink>
      </div>
    </section>

    <section id="formats" class="section">
      <header class="section__header">
        <h2>Форматы обучения</h2>
        <p>Подбираем удобный формат под график, территорию и задачи вашего предприятия.</p>
      </header>
      <div class="cards grid">
        <NuxtLink
          v-for="format in formatCards"
          :key="format.slug"
          :to="withCityPath(format.slug)"
          class="card"
        >
          <h3>{{ format.title }}</h3>
          <p>Организуем обучение в нужные сроки с официальной отчетностью и документами.</p>
        </NuxtLink>
      </div>
    </section>

    <section class="section">
      <header class="section__header">
        <h2>Почему выбирают нас</h2>
      </header>
      <ul class="list">
        <li>Государственная лицензия и аккредитации по ключевым направлениям.</li>
        <li>Преподаватели-практики с опытом внедрения систем безопасности на производствах.</li>
        <li>Срочные программы и обучение в удобные для клиента сроки.</li>
        <li>Онлайн, очные и выездные форматы по всей территории Казахстана.</li>
        <li>Полный пакет документов для проверок, тендеров и внутренних регламентов.</li>
      </ul>
    </section>

    <section class="section">
      <header class="section__header">
        <h2>Лицензии и сертификаты</h2>
        <p>Скан-копии и реквизиты — по запросу или в открытом доступе.</p>
      </header>
      <div class="licenses grid">
        <div class="license placeholder">Лицензия</div>
        <div class="license placeholder">Аккредитация</div>
        <div class="license placeholder">Сертификат</div>
      </div>
    </section>

    <section class="section">
      <header class="section__header">
        <h2>Отзывы и клиенты</h2>
      </header>
      <div class="feedback grid">
        <div class="feedback__item">
          <h3>АО «Промышленность»</h3>
          <p>«Организовали срочное обучение персонала под тендер — все документы подошли контролерам».</p>
        </div>
        <div class="feedback__item">
          <h3>ТОО «Энергия»</h3>
          <p>«Удобные онлайн-сессии и выездная аттестация на площадке. Закрыли требования по ОТ и ПБ».</p>
        </div>
      </div>
    </section>

    <section class="section">
      <header class="section__header">
        <h2>Полезные материалы</h2>
        <p>Свежие разъяснения по требованиям надзора и подготовке к проверкам.</p>
      </header>
      <div class="blog-list">
        <article
          v-for="post in blogArticles || []"
          :key="post._path"
          class="blog-card"
        >
          <header>
            <h3>
              <NuxtLink :to="post._path">{{ post.title }}</NuxtLink>
            </h3>
            <time :datetime="post.date">{{ post.date }}</time>
          </header>
          <p>{{ post.description }}</p>
        </article>
        <p v-if="!blogArticles || blogArticles.length === 0">Статьи появятся совсем скоро.</p>
      </div>
    </section>

    <section id="contact" class="section cta">
      <header class="section__header">
        <h2>Готовы обсудить обучение</h2>
        <p>Оставьте заявку — подберем программу и формат под ваш запрос.</p>
      </header>
      <div class="cta__actions">
        <a class="btn primary" href="/contacts">Оставить заявку</a>
        <a class="btn ghost" href="tel:+77000000000">Позвонить</a>
      </div>
    </section>
  </div>
</template>
