<script setup lang="ts">
const props = defineProps<{ programId: string }>();
const { api, tr, locale } = useLmsApi();
const { data, pending, error, refresh } = await useAsyncData(
  "lms-authoring-guide-" + props.programId,
  () =>
    api<any>(
      "/admin/programs/" +
        encodeURIComponent(props.programId) +
        "/authoring-guide",
    ),
);
const guide = computed(() => data.value?.guide);
</script>
<template>
  <details class="rounded-xl border bg-slate-50 p-4">
    <summary class="cursor-pointer font-semibold">
      {{
        tr(
          "Материалы для подготовки программы",
          "Бағдарламаны дайындауға арналған материалдар",
        )
      }}
    </summary>
    <LmsState :pending="pending" :error="error" @retry="refresh">
      <div v-if="guide" class="mt-5 space-y-4">
        <p class="lms-note">
          {{
            tr(
              "Предоставленный перечень услуг помогает выбрать направление. Учебный план, уроки, часы, практика и правила экзамена оформляются и проверяются отдельно перед публикацией.",
              "Берілген қызметтер тізімі бағытты таңдауға көмектеседі. Оқу жоспары, сабақтар, сағаттар, практика және емтихан ережелері жариялауға дейін бөлек жасалып, тексеріледі.",
            )
          }}
        </p>
        <div v-if="guide.source" class="space-y-3">
          <h3 class="font-semibold">
            {{
              guide.source.documentTitle ||
              tr("Предоставленный документ", "Берілген құжат")
            }}
            · {{ tr("страница", "бет") }} {{ guide.source.sourcePage }},
            {{ tr("позиция", "тармақ") }} {{ guide.source.sourceRow }}
          </h3>
          <p
            v-if="guide.source.sourceNameRaw"
            class="whitespace-pre-line text-sm"
          >
            {{ guide.source.sourceNameRaw }}
          </p>
          <p
            v-if="guide.source.sourceDescriptionRaw"
            class="whitespace-pre-line text-sm"
          >
            {{ guide.source.sourceDescriptionRaw }}
          </p>
          <p
            v-if="guide.source.sourceNoteRaw"
            class="whitespace-pre-line text-sm"
          >
            {{ guide.source.sourceNoteRaw }}
          </p>
          <p v-if="guide.source.standardAsWritten" class="text-sm">
            {{ tr("Обозначение в источнике:", "Дереккөздегі белгіленуі:") }}
            {{ guide.source.standardAsWritten }}
          </p>
        </div>
        <p v-else class="text-sm text-slate-600">
          {{
            tr(
              "Для этого направления материалы ещё не прикреплены. Добавьте содержание и ссылки на использованные источники в редакторе.",
              "Бұл бағытқа материалдар әлі тіркелмеген. Редакторға мазмұнды және қолданылған дереккөздерге сілтемелерді қосыңыз.",
            )
          }}
        </p>
        <p v-if="guide.pricing" class="font-semibold">
          {{ guide.pricing.label[locale === "kk" ? "kk" : "ru"] }}
          <span class="font-normal">{{
            guide.pricing.basisLabel[locale === "kk" ? "kk" : "ru"]
          }}</span>
        </p>
        <ul class="space-y-2 text-sm">
          <li
            v-for="field in guide.fields"
            :key="field.path"
            class="rounded-lg border bg-white p-3"
          >
            <span class="font-medium">{{
              field.label[locale === "kk" ? "kk" : "ru"]
            }}</span>
            —
            {{
              field.provided
                ? tr("Есть сведения в источнике", "Дереккөзде мәлімет бар")
                : tr(
                    "Нужно подготовить и проверить",
                    "Дайындау және тексеру керек",
                  )
            }}
          </li>
        </ul>
      </div>
    </LmsState>
  </details>
</template>
