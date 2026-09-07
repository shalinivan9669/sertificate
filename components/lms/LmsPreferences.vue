<script setup lang="ts">
const { api, tr, errorText } = useLmsApi();
const { data, pending, error, refresh } = await useAsyncData(
  "lms-consents",
  () => api<{ marketing: boolean }>("/me/consents"),
);
const marketing = ref(false);
const busy = ref(false);
const failure = ref("");
const message = ref("");
watch(
  data,
  (value) => {
    marketing.value = !!value?.marketing;
  },
  { immediate: true },
);
async function save() {
  busy.value = true;
  failure.value = "";
  message.value = "";
  try {
    await api("/me/consents", {
      method: "POST",
      body: { marketing: marketing.value, version: "marketing-v1" },
    });
    message.value = tr("Предпочтения сохранены.", "Қалаулар сақталды.");
    await refresh();
  } catch (e) {
    failure.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section class="lms-card max-w-2xl space-y-5">
    <h2 class="text-xl font-semibold">
      {{ tr("Необязательные уведомления", "Міндетті емес хабарламалар") }}
    </h2>
    <LmsState :pending="pending" :error="error" @retry="refresh"
      ><form class="space-y-4" @submit.prevent="save">
        <label class="flex items-start gap-3"
          ><input v-model="marketing" type="checkbox" class="mt-1" /><span>{{
            tr(
              "Хочу получать новости и предложения OT Center. Согласие можно отозвать в любой момент.",
              "OT Center жаңалықтары мен ұсыныстарын алғым келеді. Келісімді кез келген уақытта қайтарып алуға болады.",
            )
          }}</span></label
        >
        <p class="text-sm text-slate-600">
          {{
            tr(
              "Необходимые сообщения о безопасности и действующих назначениях управляются отдельно от рекламной подписки.",
              "Қауіпсіздік және қолданыстағы тағайындаулар туралы қажетті хабарламалар жарнамалық жазылымнан бөлек басқарылады.",
            )
          }}
        </p>
        <button class="lms-button" :disabled="busy">
          {{ tr("Сохранить предпочтения", "Қалауларды сақтау") }}
        </button>
        <p v-if="failure" class="lms-error" role="alert">{{ failure }}</p>
        <p v-if="message" class="lms-success" role="status">{{ message }}</p>
      </form></LmsState
    >
  </section>
</template>
