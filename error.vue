<script setup lang="ts">
import type { NuxtError } from '#app';
import { computed } from 'vue';
import { clearError, useHead, useRequestURL } from '#imports';

const props = defineProps<{ error: NuxtError & { url?: string } }>();
const requestUrl = useRequestURL();
const isKk = computed(() => /^\/kk(?:\/|$)/.test(new URL(props.error.url || requestUrl.pathname, requestUrl).pathname));
const tr = (ru: string, kk: string) => isKk.value ? kk : ru;
const status = computed(() => Number(props.error.status || props.error.statusCode) || 500);
const missing = computed(() => status.value === 404);
const restricted = computed(() => status.value === 401 || status.value === 403);
const home = computed(() => isKk.value ? '/kk' : '/');
const catalog = computed(() => isKk.value ? '/kk/courses' : '/courses');
const contacts = computed(() => isKk.value ? '/kk/contacts' : '/contacts');
const title = computed(() => missing.value
  ? tr('Страница не найдена', 'Бет табылмады')
  : restricted.value
    ? tr('Эта страница недоступна', 'Бұл бет қолжетімсіз')
    : tr('Не удалось открыть страницу', 'Бетті ашу мүмкін болмады'));
const description = computed(() => missing.value
  ? tr('Возможно, ссылка изменилась. Найдите нужную программу в каталоге или вернитесь на главную.', 'Сілтеме өзгерген болуы мүмкін. Қажетті бағдарламаны каталогтан табыңыз немесе басты бетке оралыңыз.')
  : restricted.value
    ? tr('Для просмотра может потребоваться вход или доступ к программе. Вернитесь на главную и откройте личный кабинет.', 'Қарау үшін жүйеге кіру немесе бағдарламаға қолжетімділік қажет болуы мүмкін. Басты бетке оралып, жеке кабинетті ашыңыз.')
    : tr('Страница сейчас не загрузилась. Можно попробовать ещё раз или перейти в другой раздел.', 'Бет қазір жүктелмеді. Қайталап көріңіз немесе басқа бөлімге өтіңіз.'));

function recover(event: MouseEvent, redirect: string) {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  void clearError({ redirect });
}
function retry() { window.location.reload(); }

useHead(() => ({
  title: `${title.value} — OT Center`,
  htmlAttrs: { lang: isKk.value ? 'kk' : 'ru' },
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
}));
</script>

<template>
  <div class="editorial-site ed-error-page">
    <header class="ed-error-masthead">
      <a class="ed-error-brand" :href="home" @click="recover($event, home)">OT Center</a>
      <span>{{ tr('Учебный центр', 'Оқу орталығы') }}</span>
    </header>
    <main id="main-content" class="ed-error-content">
      <p class="ed-error-status">{{ tr('Ошибка', 'Қате') }} {{ status }}</p>
      <h1>{{ title }}</h1>
      <p class="ed-error-description">{{ description }}</p>
      <div class="ed-error-actions">
        <a class="ed-error-primary" :href="catalog" @click="recover($event, catalog)">{{ tr('Каталог программ', 'Бағдарламалар каталогы') }}</a>
        <a :href="home" @click="recover($event, home)">{{ tr('На главную', 'Басты бетке') }}</a>
        <button v-if="!missing && !restricted" type="button" @click="retry">{{ tr('Попробовать снова', 'Қайталап көру') }}</button>
      </div>
    </main>
    <footer class="ed-error-help">
      <p>{{ tr('Нужна помощь с обучением?', 'Оқу бойынша көмек керек пе?') }}</p>
      <a :href="contacts" @click="recover($event, contacts)">{{ tr('Связаться с центром', 'Орталыққа хабарласу') }}</a>
      <a href="tel:+77766803282">8 (776) 680-32-82</a>
    </footer>
  </div>
</template>

<style scoped>
.ed-error-page { min-height: 100vh; min-height: 100svh; display: flex; flex-direction: column; padding: 0 clamp(20px, 5vw, 72px); }
.ed-error-masthead { display: flex; align-items: center; justify-content: space-between; gap: 24px; min-height: 108px; border-bottom: 1px solid var(--ed-rule); }
.ed-error-brand { color: var(--ed-ink); font: 500 34px/1.2 var(--ed-display); letter-spacing: -.03em; }
.ed-error-masthead > span { font-size: 14px; color: var(--ed-muted); }
.ed-error-content { width: min(100%, 1000px); flex: 1; padding: clamp(52px, 10vh, 100px) 0 72px; }
.ed-error-status { color: var(--ed-muted); font-size: 14px; margin-bottom: 24px; }
.ed-error-content h1 { font-size: clamp(38px, 5vw, 64px); max-width: 20ch; line-height: 1.1; overflow-wrap: anywhere; }
.ed-error-description { color: var(--ed-muted); font-size: 19px; max-width: 60ch; margin-top: 26px; line-height: 1.7; }
.ed-error-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 16px 28px; margin-top: 36px; }
.ed-error-actions :is(a, button) { display: inline-flex; min-height: 48px; align-items: center; justify-content: center; color: var(--ed-ink); font-size: 15px; font-weight: 500; text-decoration: underline; text-underline-offset: 5px; }
.ed-error-actions .ed-error-primary { padding: 12px 24px; background: var(--ed-ink); color: var(--ed-paper); border-radius: var(--ed-radius); text-decoration: none; }
.ed-error-actions .ed-error-primary:hover { background: #294449; }
.ed-error-help { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 28px; border-top: 1px solid var(--ed-rule); padding: 24px 0; font-size: 14px; }
.ed-error-help p { color: var(--ed-muted); }
.ed-error-help a { color: var(--ed-ink); display: inline-flex; align-items: center; min-height: 44px; text-decoration: underline; text-underline-offset: 4px; }
@media (max-width: 480px) {
  .ed-error-masthead { min-height: 88px; gap: 16px; }
  .ed-error-brand { font-size: 29px; }
  .ed-error-masthead > span { font-size: 12px; }
  .ed-error-content { padding: 48px 0; }
  .ed-error-description { font-size: 17px; }
  .ed-error-actions .ed-error-primary { width: 100%; }
  .ed-error-help { align-items: flex-start; gap: 0 20px; }
  .ed-error-help p { width: 100%; margin-bottom: 8px; }
}
</style>
