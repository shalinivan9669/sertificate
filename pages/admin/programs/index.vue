<script setup lang="ts">
const { api, tr, statusLabel, date } = useLmsApi();
const { data: me } = await useAsyncData("lms-me", () => api<any>("/me"));
const canEdit = computed(() =>
  ["editor", "admin"].includes(me.value?.user?.role),
);
const { data, pending, error, refresh } = await useAsyncData(
  "lms-admin-versions",
  () => api<any>("/admin/program-versions"),
);
const selected = ref<any>(null);
const editing = ref(false);
async function saved(version: any) {
  selected.value = version;
  await refresh();
}
useHead(() => ({
  title: tr(
    "Редактор программ — OT Center",
    "Бағдарламалар редакторы — OT Center",
  ),
  meta: [{ name: "robots", content: "noindex, nofollow" }],
}));
</script>
<template>
  <LmsShell
    :title="
      tr('Учебные программы и версии', 'Оқу бағдарламалары мен нұсқалары')
    "
    back="/admin"
    ><LmsState :pending="pending && !data" :error="error" @retry="refresh"
      ><div class="flex flex-wrap justify-between gap-4">
        <p class="max-w-3xl text-slate-600">
          {{
            tr(
              "Создавайте материалы в черновике, передавайте на независимую проверку и публикуйте новые версии. Назначения учащихся сохраняют свою редакцию.",
              "Материалдарды жобада жасап, тәуелсіз тексеруге жіберіңіз және жаңа нұсқаларды жариялаңыз. Оқушылардың тағайындаулары өз редакциясын сақтайды.",
            )
          }}
        </p>
        <button
          v-if="canEdit"
          class="lms-button"
          @click="
            selected = null;
            editing = true;
          "
        >
          {{ tr("Создать черновик", "Жоба жасау") }}
        </button>
      </div>
      <div class="grid gap-4 md:grid-cols-2">
        <button
          v-for="v in data?.versions"
          :key="v.id"
          class="lms-card text-left"
          @click="
            selected = v;
            editing = true;
          "
        >
          <h2 class="text-lg font-semibold">{{ v.data.title }}</h2>
          <p class="mt-2 text-sm">
            {{ v.data.language.toUpperCase() }} · {{ tr("Версия", "Нұсқа") }}
            {{ v.version }} · {{ statusLabel(v.status) }}
          </p>
          <p v-if="v.publishedAt" class="mt-1 text-xs text-slate-500">
            {{ date(v.publishedAt) }}
          </p>
        </button>
      </div>
      <p v-if="!data?.versions?.length" class="lms-note">
        {{
          tr(
            "Версий пока нет. Создайте черновик и добавьте утверждённые материалы.",
            "Нұсқалар әлі жоқ. Жоба жасап, бекітілген материалдарды қосыңыз.",
          )
        }}
      </p>
      <LmsProgramEditor
        v-if="editing"
        :version="selected"
        :actor-role="me?.user?.role"
        :actor-id="me?.user?.id"
        @saved="saved" /></LmsState
  ></LmsShell>
</template>
