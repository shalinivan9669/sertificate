<script setup>
import { computed } from 'vue';
import { useHead, useI18n } from '#imports';
import { publicAuthorities } from '~/config/compliance';

const { locale } = useI18n();
const lang = computed(() => (locale.value === 'kk' ? 'kk' : 'ru'));

useHead(() => ({
  title:
    lang.value === 'kk'
      ? 'Өкілеттіктер мен құжаттар — OT Center'
      : 'Полномочия и документы — OT Center',
  meta: [
    {
      name: 'description',
      content:
        lang.value === 'kk'
          ? 'OT Center сайтында жарияланған өкілеттік құжаттарының нақты атауы, иесі, қолданылу саласы және тексеру тәсілі.'
          : 'Точное название, владелец, область действия и способ проверки документов о полномочиях, опубликованных на сайте OT Center.',
    },
  ],
}));
</script>

<template>
  <main class="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
    <header class="space-y-3">
      <h1 class="text-4xl font-bold tracking-tight text-slate-950">
        {{ lang === 'kk' ? 'Өкілеттіктер мен құжаттар' : 'Полномочия и документы' }}
      </h1>
      <p class="max-w-3xl leading-7 text-slate-700">
        {{
          lang === 'kk'
            ? 'Біз “лицензия” сөзін барлық құжатқа қолданбаймыз. Төменде құжатта көрсетілген нақты заңдық атау, иесі және қолданылу саласы берілген.'
            : 'Мы не называем все документы «лицензиями». Ниже указаны точное юридическое название, владелец и область действия так, как это следует из проверенного документа.'
        }}
      </p>
    </header>

    <article
      v-for="authority in publicAuthorities"
      :key="authority.id"
      class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <p class="text-sm font-semibold text-slate-500">{{ authority.number }}</p>
      <h2 class="mt-2 max-w-4xl text-2xl font-bold text-slate-950">
        {{ authority.title[lang] || authority.title.ru }}
      </h2>

      <div class="mt-5 grid gap-4 md:grid-cols-2">
        <div class="rounded-2xl bg-slate-50 p-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {{ lang === 'kk' ? 'Құжат иесі' : 'Владелец документа' }}
          </p>
          <p class="mt-1 font-semibold text-slate-900">{{ authority.legalEntity }}</p>
          <p class="mt-1 text-sm text-slate-600">БИН {{ authority.bin }}</p>
        </div>
        <div class="rounded-2xl bg-slate-50 p-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {{ lang === 'kk' ? 'Беруші орган' : 'Орган выдачи' }}
          </p>
          <p class="mt-1 font-semibold text-slate-900">
            {{ authority.issuer[lang] || authority.issuer.ru }}
          </p>
          <p class="mt-1 text-sm text-slate-600">09.02.2026</p>
        </div>
      </div>

      <div class="mt-5 space-y-3 text-slate-700">
        <p>
          <strong>{{ lang === 'kk' ? 'Қолданылу саласы' : 'Область действия' }}:</strong>
          {{ authority.scope[lang] || authority.scope.ru }}
        </p>
        <p class="text-sm">{{ authority.validity[lang] || authority.validity.ru }}</p>
        <p class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          {{
            lang === 'kk'
              ? 'OT Center бренді мен құжат иесі арасындағы заңдық қатынас бөлек құжатпен расталуы тиіс. Осы тексеру аяқталғанға дейін аттестат тек нақты иесі мен нақты қолданылу саласымен көрсетіледі.'
              : 'Юридическая связь бренда OT Center с владельцем документа должна подтверждаться отдельно. До завершения этой проверки аттестат публикуется только с точным владельцем и точной областью действия.'
          }}
        </p>
      </div>

      <div class="mt-6 flex flex-wrap gap-3">
        <a
          :href="authority.documentUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
        >
          {{ lang === 'kk' ? 'Құжатты ашу' : 'Открыть документ' }}
        </a>
        <a
          :href="authority.verificationUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800"
        >
          {{ lang === 'kk' ? 'eLicense арқылы тексеру' : 'Проверить через eLicense' }}
        </a>
        <NuxtLink
          to="/compliance"
          class="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800"
        >
          {{ lang === 'kk' ? 'Нормативтік мәртебе' : 'Нормативный статус' }}
        </NuxtLink>
      </div>
    </article>

    <section class="rounded-3xl border border-dashed border-slate-300 p-6">
      <h2 class="text-xl font-bold text-slate-950">
        {{ lang === 'kk' ? 'Жарияланбаған құжаттар' : 'Документы, ожидающие проверки' }}
      </h2>
      <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
        {{
          lang === 'kk'
            ? 'OT Center пайдаланатын басқа нақты құжаттар скан немесе ресми тексеру алынғанға дейін ішкі реестрде сақталады. Олар жария сайтта расталған факт ретінде көрсетілмейді.'
            : 'Другие реальные документы, которыми располагает OT Center, до получения скана и официальной проверки сохраняются во внутреннем реестре ожидания. На публичном сайте они не показываются как подтверждённый факт.'
        }}
      </p>
    </section>
  </main>
</template>
