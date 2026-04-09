<script setup>
defineProps({
  title: { type: String, required: true },
  organization: { type: String, required: true },
  courseName: { type: String, required: true },
  participantName: { type: String, required: true },
  invoiceDate: { type: String, required: true },
  invoiceNumber: { type: String, required: true },
  services: { type: Array, required: true },
});
</script>

<template>
  <div>
    <div class="mb-10">
      <h1 class="mb-4 text-4xl font-extrabold tracking-tight text-primary md:text-5xl">{{ title }}</h1>
      <p class="font-medium opacity-70 text-on-surface-variant">{{ organization }}</p>
    </div>

    <div class="mb-8 rounded-xl border-l-4 border-secondary bg-surface-container-low p-8 shadow-sm">
      <div class="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <p class="mb-2 text-xs font-bold uppercase tracking-widest text-outline">Название курса</p>
          <p class="text-lg font-semibold text-primary">{{ courseName }}</p>
        </div>
        <div>
          <p class="mb-2 text-xs font-bold uppercase tracking-widest text-outline">Участник</p>
          <p class="text-lg font-semibold text-primary">{{ participantName }}</p>
        </div>
        <div>
          <p class="mb-2 text-xs font-bold uppercase tracking-widest text-outline">Дата выставления</p>
          <p class="text-lg font-semibold text-primary">{{ invoiceDate }}</p>
        </div>
        <div>
          <p class="mb-2 text-xs font-bold uppercase tracking-widest text-outline">Номер инвойса</p>
          <p class="text-lg font-semibold text-primary">{{ invoiceNumber }}</p>
        </div>
      </div>
    </div>

    <div class="space-y-4">
      <h3 class="px-2 text-xl font-bold text-primary">Сведения об услугах</h3>
      <div class="overflow-hidden rounded-xl bg-white shadow-sm">
        <table class="w-full border-collapse text-left">
          <thead class="bg-surface-container-high">
            <tr>
              <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-outline">Описание</th>
              <th class="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-outline">Сумма</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-surface-container">
            <tr v-for="service in services" :key="service.title" class="transition-colors hover:bg-surface-container-low">
              <td class="px-6 py-4">
                <p class="font-medium text-primary">{{ service.title }}</p>
                <p class="text-xs text-outline">{{ service.description }}</p>
              </td>
              <td class="px-6 py-4 text-right font-semibold">{{ service.amount }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
