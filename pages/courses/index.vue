<script setup lang="ts">
import { additionalSourceDirections } from '~/shared/source-products';

const { api, tr, locale } = useLmsApi();
const path = useLocalePath();
const { data, pending, error, refresh } = await useAsyncData(
  "lms-catalog",
  () => api<{ programs: LmsProgram[] }>("/catalog/programs"),
);
onMounted(() => {
  void refresh();
});
const search = ref("");
const direction = ref("");
const newDirectionIds = new Set<string>(additionalSourceDirections.map(item => item.id));
const programs = computed(() =>
  (data.value?.programs || []).filter(
    (p) =>
      (!direction.value || p.id === direction.value) &&
      (
        p.title.ru +
        p.title.kk +
        (p.sourceProduct?.guidance?.summary.ru || "") +
        (p.sourceProduct?.guidance?.summary.kk || "")
      )
        .toLowerCase()
        .includes(search.value.toLowerCase()),
  ).sort((a, b) => Number(newDirectionIds.has(b.directionId)) - Number(newDirectionIds.has(a.directionId))),
);
useHead(() => ({
  title: tr(
    "Каталог программ — OT Center",
    "Бағдарламалар каталогы — OT Center",
  ),
  meta: [
    {
      name: "description",
      content: tr(
        "Направления и программы обучения OT Center. Содержание, условия, языки и запись на обучение.",
        "OT Center оқу бағыттары мен бағдарламалары. Мазмұны, шарттары, тілдері және оқуға жазылу.",
      ),
    },
  ],
}));
</script>
<template>
  <LmsShell
    :title="tr('Программы обучения', 'Оқу бағдарламалары')"
    :subtitle="
      tr(
        'Выберите направление, изучите содержание и условия обучения. Подберём подходящий вариант для вашей работы и команды.',
        'Бағытты таңдап, оқу мазмұны мен шарттарымен танысыңыз. Жұмысыңызға және командаңызға сәйкес нұсқаны таңдауға көмектесеміз.',
      )
    "
  >
    <div class="lms-card grid gap-5 md:grid-cols-2">
      <label class="space-y-2"
        ><span>{{ tr("Поиск программы", "Бағдарламаны іздеу") }}</span
        ><input
          v-model="search"
          type="search"
          :placeholder="tr('Название направления', 'Бағыт атауы')" /></label
      ><label class="space-y-2"
        ><span>{{ tr("Направление", "Бағыт") }}</span
        ><select v-model="direction">
          <option value="">
            {{ tr("Все направления", "Барлық бағыттар") }}
          </option>
          <option v-for="d in LMS_DIRECTIONS" :key="d.id" :value="d.id">
            {{ locale === "kk" ? d.kk : d.ru }}
          </option>
        </select></label
      >
    </div>
    <LmsState
      :pending="pending"
      :error="error"
      :empty="!programs.length"
      :empty-text="
        tr(
          'По выбранным условиям программ не найдено. Попробуйте другой запрос.',
          'Таңдалған шарттар бойынша бағдарламалар табылмады. Басқа сұрауды көріңіз.',
        )
      "
      @retry="refresh"
    >
      <div class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="p in programs"
          :key="p.id"
          class="lms-card flex flex-col gap-4"
        >
          <p class="flex flex-wrap items-center justify-between gap-2 text-sm font-medium text-brand-accent">
            <span>{{
                p.availability === "published"
                  ? tr("Открыта запись", "Тіркелу ашық")
                  : tr("Подбор с консультантом", "Кеңесшімен таңдау")
            }}</span>
            <span v-if="newDirectionIds.has(p.directionId)" class="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold">
              {{ tr("Новое", "Жаңа") }}
            </span>
          </p>
          <h2 class="font-headline text-xl font-bold">
            {{ p.title[locale === "kk" ? "kk" : "ru"] }}
          </h2>
          <p
            v-if="p.sourceProduct?.guidance?.summary"
            class="text-sm leading-relaxed text-slate-600"
          >
            {{
              p.sourceProduct.guidance.summary[locale === "kk" ? "kk" : "ru"]
            }}
          </p>
          <p
            v-if="p.sourceProduct?.guidance?.audience"
            class="text-sm text-slate-600"
          >
            {{ tr("Для кого:", "Кім үшін:") }}
            {{
              p.sourceProduct.guidance.audience[locale === "kk" ? "kk" : "ru"]
            }}
          </p>
          <p class="font-semibold text-brand">
            {{
              p.pricing?.label[locale === "kk" ? "kk" : "ru"] ||
              tr("Стоимость по запросу", "Бағасы сұрау бойынша")
            }}
          </p>
          <p v-if="p.pricing?.basis" class="text-sm text-slate-600">
            {{ p.pricing.basisLabel[locale === "kk" ? "kk" : "ru"] }}
            <span v-if="p.pricing.taxLabel?.[locale === 'kk' ? 'kk' : 'ru']">
              · {{ p.pricing.taxLabel[locale === "kk" ? "kk" : "ru"] }}
            </span>
          </p>
          <div
            v-if="p.versions.length"
            class="space-y-2 text-sm text-slate-600"
          >
            <p>
              {{
                p.versions
                  .map((v) => v.language.toUpperCase())
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .join(" / ")
              }}
            </p>
          </div>
          <p v-else class="text-sm leading-relaxed text-slate-600">
            {{
              tr(
                "Уточните аудиторию, формат и ближайшую возможность обучения.",
                "Аудиторияны, форматты және жақын оқу мүмкіндігін нақтылаңыз.",
              )
            }}
          </p>
          <NuxtLink
            class="lms-button mt-auto"
            :to="path('/courses/' + p.slug)"
            >{{ tr("Содержание и условия", "Мазмұны мен шарттары") }}</NuxtLink
          >
        </article>
      </div>
    </LmsState></LmsShell
  >
</template>
