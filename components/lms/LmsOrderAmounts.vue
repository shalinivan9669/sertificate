<script setup lang="ts">
const props = defineProps<{
  order: { paidMinor?: number; refundedMinor?: number; refundableMinor?: number; currency?: string };
}>();
const { tr, money } = useLmsApi();
const available = computed(() => [props.order.paidMinor, props.order.refundedMinor, props.order.refundableMinor]
  .every(value => typeof value === "number" && Number.isSafeInteger(value) && value >= 0));
</script>

<template>
  <dl v-if="available" class="grid gap-2 text-sm sm:grid-cols-3">
    <div>
      <dt class="text-slate-600">{{ tr("Подтверждённая оплата", "Расталған төлем") }}</dt>
      <dd class="font-semibold">{{ money(order.paidMinor, order.currency) }}</dd>
    </div>
    <div>
      <dt class="text-slate-600">{{ tr("Уже возвращено", "Қайтарылған сома") }}</dt>
      <dd class="font-semibold">{{ money(order.refundedMinor, order.currency) }}</dd>
    </div>
    <div>
      <dt class="text-slate-600">{{ tr("Остаток для возврата", "Қайтаруға қалған сома") }}</dt>
      <dd class="font-semibold">{{ money(order.refundableMinor, order.currency) }}</dd>
    </div>
  </dl>
  <p v-else class="text-sm text-slate-600">
    {{ tr("Финансовая сводка пока недоступна. Обновите состояние заказа.", "Қаржылық жиынтық әзірге қолжетімсіз. Тапсырыс күйін жаңартыңыз.") }}
  </p>
</template>
