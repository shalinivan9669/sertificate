<script setup lang="ts">
const props = defineProps<{
  pending?: boolean;
  error?: any;
  empty?: boolean;
  emptyText?: string;
}>();
defineEmits(["retry"]);
const { tr, errorText } = useLmsApi();
const path = useLocalePath();
const route = useRoute();
const unauthorized = computed(() => lmsErrorStatus(props.error) === 401);
</script>
<template>
  <div v-if="pending" class="lms-note" role="status" aria-live="polite">
    {{ tr("Загружаем данные…", "Деректер жүктелуде…") }}
  </div>
  <div v-else-if="error" class="lms-error space-y-3" role="alert">
    <p>{{ errorText(error) }}</p>
    <NuxtLink
      v-if="unauthorized"
      class="lms-button"
      :to="{ path: path('/auth/login'), query: { returnTo: route.fullPath } }"
      >{{ tr("Войти в аккаунт", "Аккаунтқа кіру") }}</NuxtLink
    ><button
      v-else
      class="lms-button secondary"
      type="button"
      @click="$emit('retry')"
    >
      {{ tr("Повторить запрос", "Сұрауды қайталау") }}
    </button>
  </div>
  <div v-else-if="empty" class="lms-note" role="status">
    {{ emptyText || tr("Записей пока нет.", "Әзірге жазбалар жоқ.") }}
  </div>
  <slot v-else />
</template>
