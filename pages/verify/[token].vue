<script setup lang="ts">
const route = useRoute();
const { api, tr, date, statusLabel } = useLmsApi();
const { data, pending, error, refresh } = await useAsyncData(
  "lms-verification",
  () => api<any>("/verify/" + encodeURIComponent(String(route.params.token))),
);
useHead(() => ({
  title: tr("Проверка документа — OT Center", "Құжатты тексеру — OT Center"),
  meta: [
    { name: "robots", content: "noindex, nofollow" },
    { name: "referrer", content: "no-referrer" },
  ],
}));
</script>
<template>
  <LmsShell :title="tr('Проверка документа', 'Құжатты тексеру')"
    ><LmsState :pending="pending" :error="error" @retry="refresh"
      ><div v-if="data" class="lms-card max-w-2xl space-y-5">
        <h2 class="text-xl font-bold">{{ statusLabel(data.status) }}</h2>
        <dl class="space-y-4">
          <div>
            <dt class="text-sm text-slate-500">{{ tr("Номер", "Нөмірі") }}</dt>
            <dd>{{ data.serial }}</dd>
          </div>
          <div>
            <dt class="text-sm text-slate-500">
              {{ tr("Программа", "Бағдарлама") }}
            </dt>
            <dd>{{ data.title || data.programTitle }}</dd>
          </div>
          <div>
            <dt class="text-sm text-slate-500">
              {{ tr("Дата выдачи", "Берілген күні") }}
            </dt>
            <dd>{{ date(data.issuedAt) }}</dd>
          </div>
        </dl>
        <p class="text-sm text-slate-600">
          {{
            tr(
              "Проверка показывает актуальный статус записи OT Center. Полный документ доступен его владельцу в личном кабинете.",
              "Тексеру OT Center жазбасының ағымдағы күйін көрсетеді. Толық құжат иесіне жеке кабинетте қолжетімді.",
            )
          }}
        </p>
      </div></LmsState
    ></LmsShell
  >
</template>
