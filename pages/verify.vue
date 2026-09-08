<script setup>
import { computed } from 'vue';
import { useHead, useI18n } from '#imports';
import { publicAuthorities } from '~/config/compliance';

const { locale } = useI18n();
const lang = computed(() => (locale.value === 'kk' ? 'kk' : 'ru'));

useHead(() => ({
  title: lang.value === 'kk' ? 'Құжатты тексеру — OT Center' : 'Проверка документа — OT Center',
}));
</script>

<template>
  <main class="mx-auto w-full max-w-4xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
    <header class="space-y-3">
      <h1 class="text-4xl font-bold text-slate-950">
        {{ lang === 'kk' ? 'Құжатты тексеру' : 'Проверка документа' }}
      </h1>
      <p class="leading-7 text-slate-700">
        {{
          lang === 'kk'
            ? 'Қазіргі нұсқада жалған “табылды/расталды” жауабы жасалмайды. Мемлекеттік өкілеттік құжаттары ресми реестр арқылы тексеріледі; тыңдаушы құжаттарының жеке ашық реестрі деректер базасы мен қолжетімділік саясаты енгізілгеннен кейін қосылады.'
            : 'Текущая версия не имитирует ответ «найден/подтверждён». Государственные документы о полномочиях проверяются через официальный реестр; отдельный публичный реестр документов слушателей будет включён только после появления базы данных и политики раскрытия.'
        }}
      </p>
    </header>

    <section
      v-for="authority in publicAuthorities"
      :key="authority.id"
      class="rounded-3xl border border-slate-200 bg-white p-6"
    >
      <p class="text-sm font-semibold text-slate-500">{{ authority.number }}</p>
      <h2 class="mt-2 text-2xl font-bold text-slate-950">
        {{ authority.title[lang] || authority.title.ru }}
      </h2>
      <p class="mt-3 text-slate-700">{{ authority.legalEntity }} · БИН {{ authority.bin }}</p>
      <div class="mt-5 flex flex-wrap gap-3">
        <a
          :href="authority.verificationUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
        >
          {{ lang === 'kk' ? 'eLicense жүйесінде тексеру' : 'Проверить в eLicense' }}
        </a>
        <a
          :href="authority.documentUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800"
        >
          {{ lang === 'kk' ? 'Сайттағы PDF' : 'PDF на сайте' }}
        </a>
      </div>
    </section>
  </main>
</template>
