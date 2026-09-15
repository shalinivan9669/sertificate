<script setup lang="ts">
import { courseDirections } from '~/shared/course-registry';
import { cities } from '~/config/cities';
import { getCityName, getCityBySlug } from '~/composables/useCity';
import type { EditorialMenuSection } from '~/composables/useEditorialMenu';

const { open, section, city, link, localLink } = useEditorialMenu();
const { locale, tr } = useLmsApi();
const route = useRoute();
const { set: setSelection, fromQuery } = useLmsSelection();
const dialog = ref<HTMLDialogElement>();
const search = ref('');
let opener: HTMLElement | null = null;
let previousOverflow = '';
let locked = false;
const activeSection = computed(() => ['start', 'learning'].includes(section.value) ? 'programs' : section.value);
const sections = computed(() => [
  { id: 'programs', title: tr('Программы', 'Бағдарламалар') },
  { id: 'places', title: tr('Формат и город', 'Формат пен қала') },
  { id: 'center', title: tr('Центр и помощь', 'Орталық және көмек') },
]);
const groups = computed(() => [
  { title: tr('Безопасность труда', 'Еңбек қауіпсіздігі'), ids: ['ohrana-truda', 'promyshlennaya-bezopasnost', 'ptm', 'elektrobezopasnost', 'raboty-na-vysote', 'gpm-stropalschiki', 'gazoopasnye-raboty'] },
  { title: tr('Люди и среда', 'Адамдар және орта'), ids: ['pervaya-pomoshch', 'ekologicheskaya-bezopasnost', 'seminar-dekretirovannoy-gruppy-sez', 'upravlenie-stressom', 'menedzhment-ohrany-zdorovya'] },
  { title: tr('Управление', 'Басқару'), ids: ['antiterroristicheskaya-podgotovka', 'soglasitelnaya-komissiya', 'protivodeystvie-korruptsii', 'rassledovanie-proisshestviy', 'povedencheskiy-audit-bezopasnosti', 'kultura-bezopasnosti', 'iso-9001', 'iso-14001'] },
].map(group => ({ ...group, programs: group.ids.flatMap(id => {
  const program = courseDirections.find(item => item.id === id);
  return program && (program.title.ru + ' ' + program.title.kk).toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase()) ? [program] : [];
}) })));
const matches = computed(() => groups.value.reduce((sum, group) => sum + group.programs.length, 0));
const formats = computed(() => [
  { id: 'online', route: 'online-obuchenie', title: tr('Онлайн', 'Онлайн'), text: tr('Материалы и занятия в личном кабинете.', 'Жеке кабинеттегі материалдар мен сабақтар.') },
  { id: 'classroom', route: 'ochnoe-obuchenie', title: tr('В учебном центре', 'Оқу орталығында'), text: tr('Обучение вместе с преподавателем.', 'Оқытушымен бірге оқу.') },
  { id: 'onsite', route: 'vyezdnoe-obuchenie', title: tr('В вашей организации', 'Сіздің ұйымыңызда'), text: tr('Выездные занятия для сотрудников.', 'Қызметкерлерге арналған көшпелі сабақтар.') },
]);
const services = computed(() => [
  { hash: '#learning', title: tr('Продолжить обучение', 'Оқуды жалғастыру') },
  { hash: '#assessments', title: tr('Проверка знаний', 'Білімді тексеру') },
  { hash: '#documents', title: tr('Мои документы', 'Менің құжаттарым') },
  { hash: '#orders', title: tr('Заказы и оплата', 'Тапсырыстар мен төлем') },
]);
function unlock() { if (locked) { document.body.style.overflow = previousOverflow; locked = false; } }
function close() { open.value = false; }
watch(open, async value => {
  await nextTick();
  if (value !== open.value) return;
  if (value && !dialog.value?.open) {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    locked = true;
    dialog.value?.showModal();
    dialog.value?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus({ preventScroll: true });
  } else if (!value && dialog.value?.open) {
    dialog.value.close(); unlock(); opener?.focus({ preventScroll: true });
  }
});
function persistContext() {
  fromQuery(route.query);
  const selectedCity = getCityBySlug(route.params.city) || getCityBySlug(route.params.course) || getCityBySlug(route.query.city);
  if (selectedCity) setSelection('city', selectedCity.slug);
}
onMounted(persistContext);
watch(() => route.fullPath, () => { close(); persistContext(); });
onBeforeUnmount(() => { unlock(); dialog.value?.close(); open.value = false; });
function tabKey(event: KeyboardEvent, index: number) {
  let next = index;
  if (event.key === 'ArrowRight') next = (index + 1) % sections.value.length;
  else if (event.key === 'ArrowLeft') next = (index - 1 + sections.value.length) % sections.value.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = sections.value.length - 1;
  else return;
  event.preventDefault();
  section.value = sections.value[next]!.id as EditorialMenuSection;
  dialog.value?.querySelector<HTMLElement>('#ed-nav-tab-' + section.value)?.focus();
}
function follow(event: MouseEvent) {
  if ((event.target as HTMLElement).closest('a') && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) close();
}
function trapFocus(event: KeyboardEvent) {
  if (event.key !== 'Tab' || !dialog.value) return;
  const items = [...dialog.value.querySelectorAll<HTMLElement>('a[href],button,input,select,[tabindex]')].filter(item => item.tabIndex >= 0 && !item.hasAttribute('disabled') && item.getClientRects().length);
  if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
  else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
}
</script>

<template>
  <dialog id="editorial-menu" ref="dialog" class="ed-navigation" aria-labelledby="ed-nav-title" @cancel.prevent="close" @close="close" @click="follow" @keydown="trapFocus">
    <header class="ed-nav-masthead">
      <div><h2 id="ed-nav-title">{{ tr('Ваш следующий шаг', 'Келесі қадамыңыз') }}</h2><p>{{ city ? getCityName(city, locale) : tr('Обучение по всему Казахстану', 'Қазақстан бойынша оқыту') }}</p></div>
      <button type="button" class="ed-nav-close" :aria-label="tr('Закрыть меню', 'Мәзірді жабу')" @click="close"><span>{{ tr('Закрыть', 'Жабу') }}</span><CivicIcon name="close" /></button>
    </header>
    <div class="ed-nav-sheet">
      <div class="ed-nav-chapters" role="tablist" :aria-label="tr('Разделы меню', 'Мәзір бөлімдері')">
        <button v-for="(item, index) in sections" :id="'ed-nav-tab-' + item.id" :key="item.id" type="button" role="tab" :aria-selected="activeSection === item.id" :tabindex="activeSection === item.id ? 0 : -1" :aria-controls="'ed-nav-panel-' + item.id" @click="section = item.id as EditorialMenuSection" @keydown="tabKey($event, index)">{{ item.title }}</button>
      </div>
      <div class="ed-nav-layout">
        <section :id="'ed-nav-panel-' + activeSection" class="ed-nav-panel" role="tabpanel" :aria-labelledby="'ed-nav-tab-' + activeSection">
          <template v-if="activeSection === 'programs'">
            <div class="ed-nav-search"><label for="ed-nav-search">{{ tr('Найти направление', 'Бағытты табу') }}</label><div><CivicIcon name="search" /><input id="ed-nav-search" v-model="search" type="search" :placeholder="tr('Например, охрана труда', 'Мысалы, еңбекті қорғау')" /></div><span role="status">{{ tr('Направлений', 'Бағыттар') }}: {{ matches }}</span></div>
            <div class="ed-nav-programs"><section v-for="group in groups.filter(item => item.programs.length)" :key="group.title"><h3>{{ group.title }}</h3><NuxtLink v-for="program in group.programs" :key="program.id" :to="link('/courses/' + program.id)">{{ program.title[locale === 'kk' ? 'kk' : 'ru'] }}</NuxtLink></section></div>
            <div v-if="!matches" class="ed-nav-empty"><p>{{ tr('По этому запросу направлений нет.', 'Бұл сұрау бойынша бағыттар жоқ.') }}</p><button class="ed-text-link" type="button" @click="search = ''">{{ tr('Очистить поиск', 'Іздеуді тазарту') }}</button></div>
            <NuxtLink :to="link('/courses')" class="ed-nav-all">{{ tr('Смотреть весь каталог', 'Толық каталогты қарау') }}<CivicIcon name="arrow" /></NuxtLink>
          </template>
          <template v-else-if="activeSection === 'places'">
            <div class="ed-nav-formats"><NuxtLink v-for="item in formats" :key="item.id" :to="localLink(item.route, item.id)"><h3>{{ item.title }}</h3><p>{{ item.text }}</p><CivicIcon name="northeast" /></NuxtLink></div>
            <h3 class="ed-nav-city-title">{{ tr('Условия в вашем городе', 'Қалаңыздағы шарттар') }}</h3>
            <div class="ed-nav-city-links"><NuxtLink v-for="item in cities" :key="item.slug" :to="link('/' + item.slug, { city: item.slug })" :aria-current="item.slug === city?.slug ? 'true' : undefined">{{ getCityName(item, locale) }}<CivicIcon name="northeast" /></NuxtLink></div>
            <div class="ed-nav-needs"><NuxtLink :to="localLink('prodlenie-udostovereniy')">{{ tr('Продление удостоверений', 'Куәліктерді ұзарту') }}</NuxtLink><NuxtLink :to="localLink('obuchenie-dlya-tendera')">{{ tr('Обучение для тендера', 'Тендерге арналған оқу') }}</NuxtLink><NuxtLink :to="localLink('srochnoe-obuchenie')">{{ tr('Срочное обучение', 'Шұғыл оқыту') }}</NuxtLink></div>
          </template>
          <template v-else>
            <div class="ed-nav-center-links"><NuxtLink :to="link('/licenses')"><h3>{{ tr('Сведения о центре', 'Орталық туралы мәліметтер') }}</h3><p>{{ tr('Аккредитация и документы: как уточнить сведения.', 'Аккредиттеу мен құжаттар туралы мәліметтерді нақтылау.') }}</p></NuxtLink><NuxtLink :to="link('/blog')"><h3>{{ tr('Полезные материалы', 'Пайдалы материалдар') }}</h3><p>{{ tr('Обучение, безопасность и организация работы.', 'Оқу, қауіпсіздік және жұмысты ұйымдастыру.') }}</p></NuxtLink></div>
            <div class="ed-nav-contact"><h3>{{ tr('Обсудим вашу задачу', 'Міндетіңізді талқылайық') }}</h3><a href="tel:+77766803282">8 (776) 680-32-82</a><a href="mailto:otcenterkz@proton.me">otcenterkz@proton.me</a><NuxtLink :to="link('/contacts')">{{ tr('Контакты и форма обращения', 'Байланыс және өтініш нысаны') }}</NuxtLink></div>
            <div class="ed-nav-needs"><NuxtLink :to="link('/public-offer')">{{ tr('Условия обучения', 'Оқу шарттары') }}</NuxtLink><NuxtLink :to="link('/privacy')">{{ tr('Конфиденциальность', 'Құпиялылық') }}</NuxtLink></div>
          </template>
        </section>
        <aside class="ed-nav-tasks">
          <NuxtLink :to="link('/program-selection')" class="ed-nav-selection"><CivicIcon name="book" /><h3>{{ tr('Помочь с выбором?', 'Таңдауға көмек керек пе?') }}</h3><p>{{ tr('Четыре шага от вашей задачи к программе.', 'Міндетіңізден бағдарламаға дейін төрт қадам.') }}</p><strong>{{ tr('Подобрать обучение', 'Оқуды таңдау') }}<CivicIcon name="arrow" /></strong></NuxtLink>
          <NuxtLink :to="link('/b2b')" class="ed-nav-team"><CivicIcon name="people" /><span>{{ tr('Обучить команду', 'Команданы оқыту') }}</span><CivicIcon name="northeast" /></NuxtLink>
          <nav :aria-label="tr('Моё обучение', 'Менің оқуым')"><h3>{{ tr('Уже учитесь?', 'Оқып жатырсыз ба?') }}</h3><NuxtLink v-for="item in services" :key="item.hash" :to="link('/cabinet', { hash: item.hash })">{{ item.title }}<CivicIcon name="arrow" /></NuxtLink></nav>
          <p class="ed-nav-footnote">{{ tr('Личные материалы доступны после входа.', 'Жеке материалдар жүйеге кіргеннен кейін қолжетімді.') }}</p>
        </aside>
      </div>
    </div>
  </dialog>
</template>
