<script setup lang="ts">
const { tr, locale } = useLmsApi();
const path = useLocalePath();
const route = useRoute();
const { selection, set, fromQuery, directions } = useLmsSelection();
fromQuery(route.query);
watch(
  () => route.query,
  (q) => fromQuery(q),
  { deep: true },
);
const step = ref(1);
const chosen = computed(() =>
  directions.find((d) => d.id === selection.value.direction),
);
const steps = computed(() => [
  tr("Направление", "Бағыт"),
  tr("Ваша работа", "Жұмысыңыз"),
  tr("Формат", "Формат"),
  tr("Результат подбора", "Таңдау нәтижесі"),
]);
useHead(() => ({
  title: tr("Подбор программы — OT Center", "Бағдарлама таңдау — OT Center"),
}));
</script>
<template>
  <LmsShell
    :title="
      tr(
        'Подберём программу под вашу задачу',
        'Міндетіңізге сәйкес бағдарлама таңдаймыз',
      )
    "
    :subtitle="
      tr(
        'Выбор сохраняется при переходе между страницами. Итог помогает найти программу; условия обучения уточняются в её карточке.',
        'Таңдауыңыз беттер арасында сақталады. Нәтиже бағдарламаны табуға көмектеседі; оқу шарттары оның карточкасында нақтыланады.',
      )
    "
  >
    <ol class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <li v-for="(s, i) in steps" :key="s">
        <button
          class="w-full rounded-xl border px-3 py-3 text-left text-sm"
          :class="
            i + 1 === step
              ? 'border-brand-accent bg-brand-soft font-semibold'
              : 'border-slate-200 bg-white'
          "
          :aria-current="i + 1 === step ? 'step' : undefined"
          @click="step = i + 1"
        >
          {{ i + 1 }}. {{ s }}
        </button>
      </li>
    </ol>
    <form
      class="lms-card space-y-6"
      @submit.prevent="step = Math.min(4, step + 1)"
    >
      <fieldset v-if="step === 1" class="space-y-4">
        <legend class="text-xl font-bold">{{ steps[0] }}</legend>
        <div class="grid gap-3 md:grid-cols-2">
          <label
            v-for="d in directions"
            :key="d.id"
            class="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border p-4"
            :class="
              selection.direction === d.id
                ? 'border-brand-accent bg-brand-soft'
                : 'border-slate-200'
            "
            ><input
              type="radio"
              name="direction"
              :checked="selection.direction === d.id"
              :value="d.id"
              @change="set('direction', d.id)"
            />{{ locale === "kk" ? d.kk : d.ru }}</label
          >
        </div>
      </fieldset>
      <div v-else-if="step === 2" class="grid gap-5 md:grid-cols-2">
        <label class="space-y-2"
          ><span>{{ tr("Ваша роль", "Сіздің рөліңіз") }}</span
          ><select
            :value="selection.role"
            @change="set('role', ($event.target as HTMLSelectElement).value)"
          >
            <option value="">
              {{ tr("Выберите роль", "Рөлді таңдаңыз") }}
            </option>
            <option value="worker">
              {{ tr("Рабочий / исполнитель", "Жұмысшы / орындаушы") }}
            </option>
            <option value="manager">
              {{ tr("Руководитель / специалист", "Басшы / маман") }}
            </option>
            <option value="hr">
              {{
                tr(
                  "Организую обучение команды",
                  "Команданы оқытуды ұйымдастырамын",
                )
              }}
            </option>
          </select></label
        ><label class="space-y-2"
          ><span>{{ tr("Отрасль", "Сала") }}</span
          ><select
            :value="selection.industry"
            @change="
              set('industry', ($event.target as HTMLSelectElement).value)
            "
          >
            <option value="">
              {{ tr("Выберите отрасль", "Саланы таңдаңыз") }}
            </option>
            <option value="construction">
              {{ tr("Строительство", "Құрылыс") }}
            </option>
            <option value="industry">
              {{ tr("Промышленность", "Өнеркәсіп") }}
            </option>
            <option value="energy">{{ tr("Энергетика", "Энергетика") }}</option>
            <option value="services">
              {{
                tr("Услуги и другие отрасли", "Қызметтер және басқа салалар")
              }}
            </option>
          </select></label
        >
      </div>
      <fieldset v-else-if="step === 3" class="space-y-4">
        <legend class="text-xl font-bold">
          {{ tr("Предпочтительный формат", "Қалаулы формат") }}
        </legend>
        <label
          v-for="f in [
            { id: 'online', ru: 'Онлайн', kk: 'Онлайн' },
            { id: 'classroom', ru: 'В учебном центре', kk: 'Оқу орталығында' },
            {
              id: 'onsite',
              ru: 'На площадке организации',
              kk: 'Ұйым аумағында',
            },
          ]"
          :key="f.id"
          class="flex cursor-pointer items-center gap-3 rounded-xl border p-4"
          ><input
            type="radio"
            name="format"
            :checked="selection.format === f.id"
            @change="set('format', f.id)"
          />{{ locale === "kk" ? f.kk : f.ru }}</label
        >
      </fieldset>
      <div v-else class="space-y-5">
        <h2 class="text-xl font-bold">
          {{
            chosen
              ? locale === "kk"
                ? chosen.kk
                : chosen.ru
              : tr("Начните с выбора направления", "Алдымен бағытты таңдаңыз")
          }}
        </h2>
        <p class="text-slate-600">
          {{
            tr(
              "Направление соответствует выбранной теме. Для выбора конкретной программы учитываются ваша роль, отрасль и необходимая практическая часть.",
              "Бағыт таңдалған тақырыпқа сәйкес келеді. Нақты бағдарламаны таңдауда рөліңіз, салаңыз және қажетті практикалық бөлім ескеріледі.",
            )
          }}
        </p>
        <p v-if="selection.format !== 'online'" class="lms-note">
          {{
            tr(
              "Очный и выездной график согласуется с учебным центром.",
              "Күндізгі және көшпелі оқу кестесі оқу орталығымен келісіледі.",
            )
          }}
        </p>
        <div class="flex flex-wrap gap-3">
          <NuxtLink
            v-if="chosen"
            class="lms-button"
            :to="{
              path: path('/courses/' + chosen.id),
              query: {
                role: selection.role,
                industry: selection.industry,
                format: selection.format,
                city: selection.city,
              },
            }"
            >{{ tr("Посмотреть программу", "Бағдарламаны көру") }}</NuxtLink
          ><NuxtLink
            class="lms-button secondary"
            :to="selection.role === 'hr' ? path('/b2b') : path('/contacts')"
            >{{ tr("Помощь специалиста", "Маманның көмегі") }}</NuxtLink
          >
        </div>
      </div>
      <div
        v-if="step < 4"
        class="flex flex-wrap justify-between gap-3 border-t pt-5"
      >
        <button
          class="lms-button secondary"
          type="button"
          :disabled="step === 1"
          @click="step--"
        >
          {{ tr("Назад", "Артқа") }}</button
        ><button
          class="lms-button"
          :disabled="step === 1 && !selection.direction"
        >
          {{ tr("Следующий шаг", "Келесі қадам") }}
        </button>
      </div>
    </form></LmsShell
  >
</template>
