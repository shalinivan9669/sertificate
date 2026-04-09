<script setup>
defineProps({
  rows: { type: Array, required: true },
});
</script>

<template>
  <section class="mt-16">
    <h2 class="mb-8 px-2 font-headline text-2xl font-extrabold text-primary-container">Knowledge Breakdown</h2>
    <div class="overflow-hidden rounded-xl bg-surface-container-low">
      <table class="w-full text-left">
        <thead>
          <tr class="bg-surface-container-high/50">
            <th class="px-8 py-4 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Section Name</th>
            <th class="px-8 py-4 text-center text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Questions</th>
            <th class="px-8 py-4 text-center text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Score</th>
            <th class="px-8 py-4 text-right text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Status</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-outline-variant/10">
          <tr v-for="row in rows" :key="row.title" class="group transition-colors hover:bg-surface-container-high">
            <td class="px-8 py-5">
              <div class="flex items-center gap-3">
                <div class="h-6 w-1.5 origin-center scale-y-0 bg-secondary transition-transform group-hover:scale-y-100"></div>
                <span class="font-semibold text-primary-container">{{ row.title }}</span>
              </div>
            </td>
            <td class="px-8 py-5 text-center text-on-surface-variant">{{ row.questions }}</td>
            <td class="px-8 py-5 text-center font-bold text-secondary">{{ row.score }}%</td>
            <td class="px-8 py-5 text-right">
              <span class="rounded px-3 py-1 text-[10px] font-black uppercase tracking-tighter" :class="row.tone === 'mastered' ? 'bg-secondary-container/20 text-on-secondary-container' : 'bg-surface-container-highest text-on-surface-variant'">
                {{ row.status }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
