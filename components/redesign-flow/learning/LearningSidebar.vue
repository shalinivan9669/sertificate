<script setup>
import { logRedesignFlow } from '~/composables/useRedesignFlowDebug';

const props = defineProps({
  modules: {
    type: Array,
    required: true,
  },
  pretestTo: {
    type: String,
    default: '',
  },
  pretestLabel: {
    type: String,
    default: 'Перейти к тестированию',
  },
});

const emit = defineEmits(['open-module', 'open-section']);

const openModule = (module) => {
  if (module.state === 'locked') {
    return;
  }

  emit('open-module', module.id);
};

const openSection = (module, section) => {
  if (module.state === 'locked') {
    return;
  }

  emit('open-section', { moduleId: module.id, sectionId: section.id });
};

const openPretest = () => {
  if (!props.pretestTo) {
    logRedesignFlow('learning-sidebar', 'open-pretest:missing-target');
    return;
  }

  logRedesignFlow('learning-sidebar', 'open-pretest', {
    target: props.pretestTo,
  });
  navigateTo(props.pretestTo);
};
</script>

<template>
  <aside class="flex h-full w-80 flex-col overflow-y-auto border-r border-[#0A192F]/15 bg-[#F8F9FA] px-4 py-6">
    <div class="mb-8">
      <h2 class="mb-4 px-2 text-sm font-semibold uppercase tracking-wider text-[#0A192F]">Module Navigation</h2>
      <nav class="space-y-1">
        <div
          v-for="module in modules"
          :key="module.id"
          class="rounded-md transition-all"
        >
          <button
            class="flex w-full items-center gap-3 rounded-md p-3 text-left transition-all"
            :class="{
              'cursor-pointer text-slate-500 hover:bg-slate-200': module.state === 'completed',
              'cursor-default bg-[#4A90E2] text-white shadow-lg': module.state === 'active',
              'cursor-pointer bg-white text-[#0A192F] hover:bg-slate-100': module.state === 'available',
              'cursor-not-allowed opacity-60 text-slate-400': module.state === 'locked',
            }"
            :disabled="module.state === 'locked'"
            type="button"
            @click="openModule(module)"
          >
            <span
              class="material-symbols-outlined"
              :class="{
                'text-green-600': module.state === 'completed',
                'icon-filled': module.state === 'completed' || module.state === 'active',
              }"
            >
              {{
                module.state === 'completed'
                  ? 'check_circle'
                  : module.state === 'active'
                    ? 'play_circle'
                    : module.state === 'locked'
                      ? 'lock'
                      : 'menu_book'
              }}
            </span>
            <span class="text-sm font-medium" :class="{ 'font-bold': module.state === 'active' }">{{ module.navTitle }}</span>
          </button>

          <div v-if="module.state === 'active' && module.sections?.length" class="ml-9 mt-1 space-y-1">
            <button
              v-for="section in module.sections"
              :key="section.id"
              class="block w-full border-l-2 p-2 pl-4 text-left text-sm transition-all"
              :class="section.active ? 'border-[#4A90E2] bg-[#4A90E2]/5 font-bold text-[#4A90E2]' : 'border-transparent text-slate-600 hover:text-[#4A90E2]'"
              type="button"
              @click="openSection(module, section)"
            >
              {{ section.navTitle }}
            </button>
          </div>
        </div>
      </nav>
    </div>

    <div class="mt-auto space-y-4">
      <button
        class="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0A192F] px-4 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-[#162a4a]"
        type="button"
        @click="openPretest"
      >
        <span class="material-symbols-outlined text-sm">play_arrow</span>
        <span>{{ pretestLabel }}</span>
      </button>

      <div class="rounded-xl border border-outline-variant/30 bg-surface-container-high p-4">
        <div class="mb-2 flex items-center gap-2 text-[#0A192F]">
          <span class="material-symbols-outlined text-sm">help_center</span>
          <span class="text-xs font-bold uppercase tracking-tighter">Support</span>
        </div>
        <p class="text-[11px] leading-relaxed text-on-surface-variant">
          Facing technical issues? Contact our duty officer at 24/7 technical hotline.
        </p>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.icon-filled {
  font-variation-settings: 'FILL' 1;
}
</style>
