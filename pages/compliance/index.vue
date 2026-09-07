<script setup>
import { computed } from 'vue';
import { useHead, useI18n } from '#imports';
import { laborSafetyTransition, publicAuthorities } from '~/config/compliance';

const { locale } = useI18n();
const lang = computed(() => (locale.value === 'kk' ? 'kk' : 'ru'));

useHead(() => ({
  title:
    lang.value === 'kk'
      ? 'Нормативтік ашықтық — OT Center'
      : 'Нормативная прозрачность — OT Center',
  meta: [
    {
      name: 'description',
      content:
        lang.value === 'kk'
          ? 'OT Center оқу бағыттарының құқықтық негіздері, өкілеттіктері және тексеру мәртебесі.'
          : 'Правовые основания, полномочия и статус проверки направлений обучения OT Center.',
    },
  ],
}));
</script>

<template>
  <main class="mx-auto w-full max-w-6xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
    <header class="space-y-4">
      <p class="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
        {{ lang === 'kk' ? 'Compliance center' : 'Compliance center' }}
      </p>
      <h1 class="max-w-4xl text-4xl font-bold tracking-tight text-slate-950">
        {{
          lang === 'kk'
            ? 'Нормативтік ашықтық және құжаттарды тексеру'
            : 'Нормативная прозрачность и проверка документов'
        }}
      </h1>
      <p class="max-w-3xl text-base leading-7 text-slate-700">
        {{
          lang === 'kk'
            ? 'Бұл бөлім жарнамалық уәделерді құқықтық дәлелдерден бөледі. Құжат, бағдарлама немесе өкілеттік расталмаса, курс “тексерілді” деп белгіленбейді.'
            : 'Этот раздел отделяет рекламные обещания от доказуемых оснований. Если документ, программа или полномочие не подтверждены, курс не получает статус «проверено».'
        }}
      </p>
    </header>

    <section class="rounded-3xl border border-amber-200 bg-amber-50 p-6">
      <p class="text-xs font-bold uppercase tracking-[0.14em] text-amber-900">
        {{ lang === 'kk' ? 'Өтпелі құқықтық мәртебе' : 'Переходный нормативный статус' }}
      </p>
      <h2 class="mt-2 text-2xl font-bold text-slate-950">
        {{ laborSafetyTransition.title[lang] }}
      </h2>
      <p class="mt-3 max-w-4xl leading-7 text-slate-800">
        {{ laborSafetyTransition.text[lang] }}
      </p>
      <div class="mt-4 flex flex-wrap gap-3">
        <a
          v-for="source in laborSafetyTransition.sources"
          :key="source"
          :href="source"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm font-semibold text-slate-800 underline underline-offset-4"
        >
          {{ lang === 'kk' ? 'Ресми дереккөз' : 'Официальный источник' }}
        </a>
      </div>
    </section>

    <section class="space-y-5">
      <div>
        <p class="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
          {{ lang === 'kk' ? 'Құқықтық өкілеттіктер' : 'Полномочия' }}
        </p>
        <h2 class="mt-2 text-3xl font-bold text-slate-950">
          {{ lang === 'kk' ? 'Қазір расталған құжат' : 'Проверенный на текущем этапе документ' }}
        </h2>
      </div>

      <article
        v-for="authority in publicAuthorities"
        :key="authority.id"
        class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div class="flex flex-col gap-5 lg:flex-row lg:justify-between">
          <div class="space-y-3">
            <p class="text-sm font-semibold text-slate-500">{{ authority.number }}</p>
            <h3 class="max-w-3xl text-2xl font-bold text-slate-950">
              {{ authority.title[lang] || authority.title.ru }}
            </h3>
            <dl class="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
              <div>
                <dt class="font-semibold text-slate-900">
                  {{ lang === 'kk' ? 'Иесі' : 'Владелец' }}
                </dt>
                <dd>{{ authority.legalEntity }}</dd>
              </div>
              <div>
                <dt class="font-semibold text-slate-900">БИН</dt>
                <dd>{{ authority.bin }}</dd>
              </div>
              <div>
                <dt class="font-semibold text-slate-900">
                  {{ lang === 'kk' ? 'Берілген күні' : 'Дата выдачи' }}
                </dt>
                <dd>09.02.2026</dd>
              </div>
              <div>
                <dt class="font-semibold text-slate-900">
                  {{ lang === 'kk' ? 'Беруші орган' : 'Орган выдачи' }}
                </dt>
                <dd>{{ authority.issuer[lang] || authority.issuer.ru }}</dd>
              </div>
            </dl>
            <p class="max-w-4xl leading-7 text-slate-700">
              <strong>{{ lang === 'kk' ? 'Қолданылу саласы' : 'Область действия' }}:</strong>
              {{ authority.scope[lang] || authority.scope.ru }}
            </p>
            <p class="max-w-4xl text-sm leading-6 text-slate-600">
              {{ authority.validity[lang] || authority.validity.ru }}
            </p>
            <p class="max-w-4xl rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              {{
                lang === 'kk'
                  ? 'Маңызды: жария PDF құжаттың заңды иесін көрсетеді, бірақ OT Center бренді мен осы заңды тұлға арасындағы қатынасты өздігінен дәлелдемейді. Бұл байланыс ішкі құжатпен расталмайынша, сайт аттестатты жалпы “OT Center лицензиясы” деп атамайды.'
                  : 'Важно: публичный PDF подтверждает юридического владельца документа, но сам по себе не доказывает отношение бренда OT Center к этому юрлицу. До документального подтверждения этой связи сайт не называет аттестат общей «лицензией OT Center».'
              }}
            </p>
          </div>

          <div class="flex shrink-0 flex-col gap-3">
            <a
              :href="authority.documentUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="rounded-xl bg-slate-950 px-4 py-2.5 text-center text-sm font-semibold text-white"
            >
              {{ lang === 'kk' ? 'PDF ашу' : 'Открыть PDF' }}
            </a>
            <a
              :href="authority.verificationUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="rounded-xl border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-800"
            >
              {{ lang === 'kk' ? 'eLicense тексеру' : 'Проверить в eLicense' }}
            </a>
          </div>
        </div>
      </article>
    </section>

    <section class="rounded-3xl bg-slate-950 p-7 text-white">
      <h2 class="text-2xl font-bold">
        {{ lang === 'kk' ? 'Курс қашан жариялауға дайын?' : 'Когда курс готов к публикации?' }}
      </h2>
      <p class="mt-3 max-w-4xl leading-7 text-slate-300">
        {{
          lang === 'kk'
            ? 'Провайдер, құқықтық өкілеттік, қолданыстағы НҚА, бекітілген бағдарлама, білімді тексеру тәртібі, құжаттың нақты түрі, жарамдылық мерзімі, келісімдер, материалдарға құқық және соңғы құқықтық тексеру күні расталғаннан кейін ғана.'
            : 'Только после подтверждения провайдера, полномочия, действующего НПА, утверждённой программы, правил проверки знаний, точного вида документа, срока действия, согласий, прав на материалы и даты последней юридической проверки.'
        }}
      </p>
    </section>
  </main>
</template>
