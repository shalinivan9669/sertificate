<script setup lang="ts">
defineProps<{
  title: string;
  subtitle?: string;
  back?: string;
  backQuery?: Record<string, string>;
  privatePage?: boolean;
}>();
const path = useLocalePath();
const { tr } = useLmsApi();
const { track } = useLmsAnalytics();
const route = useRoute();
const shellKind = computed(() => {
  const current = route.path.replace(/^\/kk(?=\/|$)/, "");
  if (current.startsWith("/learn/"))
    return /\/(exam|pre-test|success|failed|confirm)$/.test(current)
      ? "assessment"
      : "reading";
  if (current.startsWith("/admin")) return "admin";
  if (current.startsWith("/cabinet")) return "cabinet";
  if (current.startsWith("/auth")) return "auth";
  if (current.startsWith("/payment")) return "payment";
  if (/^\/courses\//.test(current)) return "program";
  if (current.startsWith("/certificates") || current.startsWith("/verify")) return "document";
  if (current === "/program-selection") return "selection";
  if (current === "/b2b") return "business";
  return "catalog";
});
const chapterLabel = computed(
  () =>
    ({
      assessment: tr("Проверка знаний", "Білімді тексеру"),
      reading: tr("Учебная программа", "Оқу бағдарламасы"),
      cabinet: tr("Моё пространство обучения", "Менің оқу кеңістігім"),
      auth: tr("Аккаунт OT Center", "OT Center аккаунты"),
      payment: tr("Запись на обучение", "Оқуға тіркелу"),
      program: tr("Паспорт программы", "Бағдарлама паспорты"),
      catalog: tr("Обучение по вашей задаче", "Міндетіңізге сай оқу"),
      selection: tr("Подбор обучения", "Оқуды таңдау"),
      business: tr("Обучение сотрудников", "Қызметкерлерді оқыту"),
      document: tr("Документы об обучении", "Оқу туралы құжаттар"),
      admin: tr("Управление учебным центром", "Оқу орталығын басқару"),
    })[shellKind.value],
);
</script>
<template>
  <section class="lms mx-auto max-w-6xl space-y-7" :data-surface="shellKind">
    <nav
      class="lms-nav"
      :aria-label="tr('Навигация обучения', 'Оқу навигациясы')"
    >
      <NuxtLink :to="{ path: path(back || '/courses'), query: backQuery }" class="lms-nav-back">
        <CivicIcon name="arrow" class="lms-back-icon" />
        <span>
          {{
            back
              ? tr("Назад", "Артқа")
              : tr("Каталог программ", "Бағдарламалар каталогы")
          }}
        </span>
      </NuxtLink>
      <NuxtLink v-if="!['reading', 'assessment', 'admin'].includes(shellKind)" :to="path('/program-selection')">
        <CivicIcon name="book" />
        <span>{{ tr("Подобрать программу", "Бағдарлама таңдау") }}</span>
      </NuxtLink>
      <NuxtLink :to="path('/cabinet')">
        <CivicIcon name="user" />
        <span>{{ tr("Личный кабинет", "Жеке кабинет") }}</span>
      </NuxtLink>
    </nav>
    <header class="lms-heading">
      <p class="lms-eyebrow">
        {{ chapterLabel }}
      </p>
      <h1>
        {{ title }}
      </h1>
      <p v-if="subtitle" class="lms-subtitle">
        {{ subtitle }}
      </p>
    </header>
    <EditorialAdminNav v-if="shellKind === 'admin'" />
    <EditorialContext
      v-if="shellKind === 'catalog' || shellKind === 'program'"
    />
    <slot />
    <footer class="lms-support">
      <span class="lms-support-symbol"><CivicIcon name="people" /></span>
      <p>
        <span>{{ tr("Нужна помощь?", "Көмек керек пе?") }}</span>
        <NuxtLink :to="path('/contacts')" @click="track('support_open')">{{
          tr("Связаться с OT Center", "OT Center-ге хабарласу")
        }}</NuxtLink>
      </p>
    </footer>
  </section>
</template>
