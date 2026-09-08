<script setup lang="ts">
const route = useRoute();
const { api, tr, date, statusLabel } = useLmsApi();
const id = String(route.params.id);
const { data, pending, error, refresh } = await useAsyncData(
  "lms-credential-" + id,
  () => api<any>("/credentials/" + encodeURIComponent(id)),
);
const credential = computed(() => data.value?.credential);
useHead(() => ({
  title: tr("Мой документ — OT Center", "Менің құжатым — OT Center"),
  meta: [{ name: "robots", content: "noindex, nofollow" }],
}));
</script>
<template>
  <LmsShell :title="tr('Мой документ', 'Менің құжатым')" back="/cabinet"
    ><LmsState :pending="pending" :error="error" @retry="refresh"
      ><div v-if="credential" class="lms-card max-w-3xl space-y-5">
        <p class="text-sm font-semibold text-brand-accent">
          {{ statusLabel(credential.status) }}
        </p>
        <h2 class="text-2xl font-bold">{{ credential.programTitle }}</h2>
        <dl class="grid gap-5 sm:grid-cols-2">
          <div>
            <dt class="text-sm text-slate-500">
              {{ tr("Номер документа", "Құжат нөмірі") }}
            </dt>
            <dd class="font-semibold">{{ credential.serial || "—" }}</dd>
          </div>
          <div>
            <dt class="text-sm text-slate-500">
              {{ tr("Дата выдачи", "Берілген күні") }}
            </dt>
            <dd>{{ date(credential.issuedAt) }}</dd>
          </div>
        </dl>
        <p
          v-if="
            credential.status === 'revoked' ||
            credential.status === 'superseded'
          "
          class="lms-error"
        >
          {{
            tr(
              "Этот документ отозван или заменён. Уточните актуальные сведения в учебном центре.",
              "Бұл құжаттың күші жойылған немесе ауыстырылған. Оқу орталығынан өзекті мәліметті нақтылаңыз.",
            )
          }}
        </p>
        <a
          v-if="credential.status === 'issued' && credential.downloadAvailable"
          class="lms-button"
          :href="'/api/v1/credentials/' + encodeURIComponent(id) + '/download'"
          >{{ tr("Скачать документ", "Құжатты жүктеу") }}</a
        >
        <p v-else-if="credential.status === 'issued'" class="lms-note">
          {{
            tr(
              "Запись о выдаче есть. Файл документа пока не готов. Обновите статус позднее или свяжитесь с учебным центром.",
              "Құжатты беру жазбасы бар. Құжат файлы әзірге дайын емес. Кейінірек күйін жаңартыңыз немесе оқу орталығына хабарласыңыз.",
            )
          }}
        </p>
        <button class="lms-button secondary" @click="refresh()">
          {{ tr("Обновить статус", "Күйін жаңарту") }}
        </button>
      </div></LmsState
    ></LmsShell
  >
</template>
