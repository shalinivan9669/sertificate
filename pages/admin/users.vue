<script setup lang="ts">
const { api, tr, errorText } = useLmsApi();
const search = ref("");
const { data, pending, error, refresh } = await useAsyncData(
  "lms-admin-users",
  () => api<any>("/admin/users", { query: { query: search.value } }),
);
const selected = ref<any>(null);
const role = ref("learner");
const reason = ref("");
const confirmed = ref(false);
const busy = ref(false);
const failure = ref("");
const message = ref("");
const roles = computed(() => [
  { id: "learner", label: tr("Слушатель", "Тыңдаушы") },
  { id: "editor", label: tr("Методист / редактор", "Әдіскер / редактор") },
  {
    id: "reviewer",
    label: tr(
      "Рецензент программ и шаблонов",
      "Бағдарламалар мен үлгілер рецензенті",
    ),
  },
  {
    id: "instructor",
    label: tr("Преподаватель / практика", "Оқытушы / практика"),
  },
  { id: "issuer", label: tr("Оформление документов", "Құжаттарды рәсімдеу") },
  { id: "finance", label: tr("Финансы", "Қаржы") },
  { id: "admin", label: tr("Администратор платформы", "Платформа әкімшісі") },
]);
const label = (value: string) =>
  roles.value.find((r) => r.id === value)?.label || value;
function choose(user: any) {
  selected.value = user;
  role.value = user.role;
  reason.value = "";
  confirmed.value = false;
  failure.value = "";
  message.value = "";
}
async function save() {
  if (!selected.value) return;
  busy.value = true;
  failure.value = "";
  message.value = "";
  try {
    await api(
      "/admin/users/" + encodeURIComponent(selected.value.id) + "/role",
      { method: "POST", body: { role: role.value, reason: reason.value } },
    );
    selected.value = null;
    message.value = tr(
      "Права обновлены. Для привилегированных операций пользователю потребуется снова подтвердить второй фактор.",
      "Құқықтар жаңартылды. Артықшылықты әрекеттер үшін пайдаланушы екінші факторды қайта растауы қажет.",
    );
    await refresh();
  } catch (e) {
    failure.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
useHead(() => ({
  title: tr(
    "Пользователи и права — OT Center",
    "Пайдаланушылар мен құқықтар — OT Center",
  ),
  meta: [{ name: "robots", content: "noindex, nofollow" }],
}));
</script>
<template>
  <LmsShell
    :title="tr('Пользователи и права', 'Пайдаланушылар мен құқықтар')"
    back="/admin"
    ><form
      class="lms-card flex flex-col gap-4 sm:flex-row sm:items-end"
      @submit.prevent="refresh()"
    >
      <label class="flex-1 space-y-2"
        ><span>{{
          tr("Поиск по имени или email", "Аты немесе email бойынша іздеу")
        }}</span
        ><input v-model="search" type="search" maxlength="150" /></label
      ><button class="lms-button" :disabled="pending">
        {{ tr("Найти пользователя", "Пайдаланушыны табу") }}
      </button>
    </form>
    <LmsState
      :pending="pending"
      :error="error"
      :empty="!data?.users.length"
      :empty-text="tr('Пользователи не найдены.', 'Пайдаланушылар табылмады.')"
      @retry="refresh"
      ><div class="grid gap-4 md:grid-cols-2">
        <article
          v-for="user in data?.users"
          :key="user.id"
          class="lms-card space-y-3"
        >
          <h2 class="text-lg font-semibold">{{ user.name }}</h2>
          <p class="text-sm">{{ user.email }}</p>
          <p class="text-sm text-slate-600">
            {{ label(user.role) }} ·
            {{
              user.emailVerified
                ? tr("Почта подтверждена", "Пошта расталған")
                : tr("Почта не подтверждена", "Пошта расталмаған")
            }}
          </p>
          <p class="text-xs text-slate-500">ID: {{ user.id }}</p>
          <button class="lms-button secondary" @click="choose(user)">
            {{ tr("Изменить права", "Құқықтарды өзгерту") }}
          </button>
        </article>
      </div></LmsState
    >
    <form v-if="selected" class="lms-card space-y-5" @submit.prevent="save">
      <h2 class="text-xl font-bold">
        {{ tr("Права пользователя", "Пайдаланушы құқықтары") }}:
        {{ selected.name }}
      </h2>
      <label class="block space-y-2"
        ><span>{{ tr("Новая роль", "Жаңа рөл") }}</span
        ><select v-model="role">
          <option v-for="item in roles" :key="item.id" :value="item.id">
            {{ item.label }}
          </option>
        </select></label
      ><label class="block space-y-2"
        ><span>{{
          tr("Основание изменения прав", "Құқықтарды өзгерту негізі")
        }}</span
        ><textarea
          v-model="reason"
          required
          minlength="10"
          maxlength="2000"
        /></label
      ><label class="flex items-start gap-3"
        ><input
          v-model="confirmed"
          required
          type="checkbox"
          class="mt-1"
        /><span>{{
          tr(
            "Подтверждаю предоставление выбранных прав этому пользователю.",
            "Осы пайдаланушыға таңдалған құқықтарды беруді растаймын.",
          )
        }}</span></label
      >
      <div class="flex flex-wrap gap-3">
        <button class="lms-button" :disabled="busy || !confirmed">
          {{
            tr("Сохранить права и основание", "Құқықтар мен негіздемені сақтау")
          }}</button
        ><button
          class="lms-button secondary"
          type="button"
          @click="selected = null"
        >
          {{ tr("Отмена", "Болдырмау") }}
        </button>
      </div>
    </form>
    <p v-if="failure" class="lms-error" role="alert">{{ failure }}</p>
    <p v-if="message" class="lms-success" role="status">
      {{ message }}
    </p></LmsShell
  >
</template>
