<script setup lang="ts">
defineProps<{
  title: string;
  subtitle?: string;
  back?: string;
  privatePage?: boolean;
}>();
const path = useLocalePath();
const { tr } = useLmsApi();
</script>
<template>
  <section class="lms mx-auto max-w-6xl space-y-7">
    <nav
      class="lms-nav grid grid-cols-1 items-center gap-x-5 gap-y-2 text-sm sm:flex sm:flex-wrap"
      :aria-label="tr('Навигация обучения', 'Оқу навигациясы')"
    >
      <NuxtLink :to="path(back || '/courses')"
        >←
        {{
          back
            ? tr("Назад", "Артқа")
            : tr("Каталог программ", "Бағдарламалар каталогы")
        }}</NuxtLink
      >
      <NuxtLink :to="path('/program-selection')">{{
        tr("Подобрать программу", "Бағдарлама таңдау")
      }}</NuxtLink>
      <NuxtLink :to="path('/cabinet')">{{
        tr("Личный кабинет", "Жеке кабинет")
      }}</NuxtLink>
    </nav>
    <header class="space-y-3">
      <p class="text-sm font-semibold tracking-wide text-brand-accent">
        OT CENTER · {{ tr("ОНЛАЙН-ОБУЧЕНИЕ", "ОНЛАЙН ОҚЫТУ") }}
      </p>
      <h1
        class="font-headline text-3xl font-bold leading-tight text-brand sm:text-4xl"
      >
        {{ title }}
      </h1>
      <p
        v-if="subtitle"
        class="max-w-3xl text-base leading-relaxed text-slate-600"
      >
        {{ subtitle }}
      </p>
    </header>
    <slot />
    <p class="border-t border-slate-200 pt-5 text-sm text-slate-600">
      {{ tr("Нужна помощь?", "Көмек керек пе?") }}
      <NuxtLink :to="path('/contacts')">{{
        tr("Связаться с OT Center", "OT Center-ге хабарласу")
      }}</NuxtLink>
    </p>
  </section>
</template>
<style>
.lms {
  overflow-wrap: anywhere;
}
.lms .lms-card {
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgb(15 23 42 / 0.035);
}
.lms .lms-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  border-radius: 0.65rem;
  background: #2b7a78;
  color: white;
  padding: 0.65rem 1.1rem;
  font-size: 0.925rem;
  font-weight: 600;
  line-height: 1.5;
  border: 1px solid transparent;
}
.lms .lms-button:hover {
  background: #236765;
  color: white;
}
.lms .lms-button.secondary {
  color: #0f172a;
  border-color: #cbd5e1;
  background: white;
}
.lms .lms-button.danger {
  background: #9f1239;
}
.lms button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.lms input:not([type="checkbox"]):not([type="radio"]),
.lms select,
.lms textarea {
  display: block;
  width: 100%;
  min-width: 0;
  border: 1px solid #94a3b8;
  border-radius: 0.65rem;
  background: white;
  padding: 0.7rem 0.8rem;
  color: #0f172a;
}
.lms input[type="checkbox"],
.lms input[type="radio"] {
  width: 1.125rem;
  height: 1.125rem;
  flex-shrink: 0;
  accent-color: #2b7a78;
}
.lms label {
  color: #334155;
}
.lms :focus-visible {
  outline: 3px solid #2b7a78;
  outline-offset: 3px;
}
.lms .lms-error {
  border: 1px solid #fda4af;
  background: #fff1f2;
  border-radius: 0.75rem;
  padding: 1rem;
  color: #881337;
}
.lms .lms-note {
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  border-radius: 0.75rem;
  padding: 1rem;
  color: #334155;
}
.lms .lms-success {
  border: 1px solid #99c8c3;
  background: #e9f1f0;
  border-radius: 0.75rem;
  padding: 1rem;
  color: #17504e;
}
@media (max-width: 420px) {
  .lms .lms-card {
    padding: 1rem;
  }
}
</style>
