<script setup lang="ts">
const route = useRoute();
const path = useLocalePath();
const { api, tr } = useLmsApi();
const { data: me } = await useAsyncData('lms-me', () => api<any>('/me'));
const normalizedPath = computed(() => route.path.replace(/^\/kk(?=\/|$)/, '').replace(/\/$/, ''));
const allowed = (roles: string[]) => me.value?.user?.role === 'admin' || roles.includes(me.value?.user?.role);
const sections = computed(() => [
  { to: '/admin', title: tr('Обзор работы', 'Жұмысқа шолу'), roles: ['editor', 'reviewer', 'instructor', 'issuer', 'finance'] },
  { to: '/admin/programs', title: tr('Программы', 'Бағдарламалар'), roles: ['editor', 'reviewer'] },
  { to: '/admin/documents', title: tr('Бланки документов', 'Құжат бланкілері'), roles: ['issuer', 'reviewer'] },
  { to: '/admin/document-batches', title: tr('Оформление групп', 'Топтарды рәсімдеу'), roles: ['issuer'] },
  { to: '/admin/users', title: tr('Пользователи', 'Пайдаланушылар'), roles: [] },
  { to: '/admin/leads', title: tr('Заявки', 'Өтінімдер'), roles: [] },
  { to: '/admin/support', title: tr('Поддержка', 'Қолдау'), roles: [] },
  { to: '/admin/analytics', title: tr('Статистика', 'Статистика'), roles: [] },
  { to: '/admin/incidents', title: tr('Контроль операций', 'Операцияларды бақылау'), roles: ['finance', 'issuer'] },
].filter(item => allowed(item.roles)));
const active = (to: string) => to === '/admin' ? normalizedPath.value === to : normalizedPath.value === to || normalizedPath.value.startsWith(to + '/');
const currentTitle = computed(() => sections.value.find(item => active(item.to))?.title || tr('Разделы управления', 'Басқару бөлімдері'));
const mobileOpen = ref(false);
watch(() => route.path, () => { mobileOpen.value = false; });
</script>

<template>
  <nav v-if="sections.length" class="ed-admin-nav" :aria-label="tr('Разделы управления', 'Басқару бөлімдері')">
    <div class="ed-admin-nav-heading"><span>{{ tr('Рабочая область', 'Жұмыс аймағы') }}</span><NuxtLink :to="path('/cabinet/security')">{{ tr('Безопасность входа', 'Кіру қауіпсіздігі') }} <span aria-hidden="true">↗</span></NuxtLink></div>
    <button class="ed-admin-nav-toggle" type="button" :aria-expanded="mobileOpen" aria-controls="admin-sections" @click="mobileOpen = !mobileOpen"><span>{{ currentTitle }}</span><span aria-hidden="true">{{ mobileOpen ? '−' : '+' }}</span></button>
    <ul id="admin-sections" :class="{ 'is-open': mobileOpen }"><li v-for="section in sections" :key="section.to"><NuxtLink :to="path(section.to)" :aria-current="active(section.to) ? 'page' : undefined"><span>{{ section.title }}</span><span v-if="active(section.to)" class="ed-admin-active-mark" aria-hidden="true">●</span></NuxtLink></li></ul>
  </nav>
</template>

<style scoped>
.ed-admin-nav { color: var(--ed-ink); border-block: 1px solid var(--ed-rule); }
.ed-admin-nav-heading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .5rem 1.5rem; padding: .65rem 0; }
.ed-admin-nav-heading > span { color: var(--ed-muted); font-size: .6875rem; letter-spacing: .12em; font-weight: 600; text-transform: uppercase; }
.ed-admin-nav-heading > a { display: inline-flex; align-items: center; min-height: 44px; gap: .75rem; font-size: .75rem; text-decoration: underline; text-underline-offset: .3em; }
.ed-admin-nav ul { display: flex; flex-wrap: wrap; column-gap: 1.5rem; list-style: none; padding: 0; }
.ed-admin-nav li { min-width: 0; }
.ed-admin-nav li a { display: flex; align-items: center; gap: .75rem; min-height: 48px; padding: .75rem 0; font-size: .8125rem; font-weight: 500; border-bottom: 3px solid transparent; }
.ed-admin-nav li a[aria-current='page'] { font-weight: 700; border-bottom-color: var(--ed-ink); }
.ed-admin-nav li a:hover { color: var(--ed-muted); }
.ed-admin-active-mark { color: var(--ed-ink); font-size: .45rem; }
.ed-admin-nav-toggle { display: none; }
@media (max-width: 700px) {
  .ed-admin-nav-heading { padding-block: .35rem; }
  .ed-admin-nav-heading > a { font-size: .6875rem; }
  .ed-admin-nav-toggle { display: flex; align-items: center; justify-content: space-between; width: 100%; min-height: 52px; gap: 1rem; text-align: left; font-size: .9375rem; font-weight: 600; border-top: 1px solid var(--ed-rule); }
  .ed-admin-nav ul { display: none; }
  .ed-admin-nav ul.is-open { display: grid; grid-template-columns: minmax(0, 1fr); padding-bottom: .75rem; }
  .ed-admin-nav li a { min-height: 48px; border-bottom: 1px solid var(--ed-rule); }
  .ed-admin-nav li a[aria-current='page'] { border-bottom-width: 2px; }
}
</style>
