<script setup lang="ts">
import { getCityBySlug, getCityName } from "~/composables/useCity";
const route = useRoute();
const { locale, tr } = useLmsApi();
const { selection } = useLmsSelection();
const city = computed(() =>
  getCityBySlug(
    typeof route.query.city === "string"
      ? route.query.city
      : selection.value.city,
  ),
);
const format = computed(() =>
  typeof route.query.format === "string"
    ? route.query.format
    : selection.value.format,
);
const formats = computed<Record<string, string>>(() => ({
  online: tr("Онлайн", "Онлайн"),
  classroom: tr("В учебном центре", "Оқу орталығында"),
  onsite: tr("В организации", "Ұйымда"),
}));
</script>
<template>
  <div
    class="ed-context"
    :aria-label="tr('Контекст выбора', 'Таңдау мәнмәтіні')"
  >
    <span v-if="city"
      ><CivicIcon name="pin" />{{ getCityName(city, locale) }}</span
    ><span
      >{{ tr("Язык интерфейса", "Интерфейс тілі") }}:
      {{ locale === "kk" ? "Қазақша" : "Русский" }}</span
    ><span v-if="formats[format]"
      >{{ tr("Предпочтение", "Қалауыңыз") }}: {{ formats[format] }}</span
    >
  </div>
</template>
