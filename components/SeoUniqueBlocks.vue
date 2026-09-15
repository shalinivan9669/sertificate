<script setup>
import { computed } from 'vue';
import { useI18n, useLocalePath } from '#imports';
import { leadContextQuery } from '~/shared/lead-context';
const props = defineProps({
  content: {
    type: Object,
    required: true,
  },
  ctaQuery: {
    type: Object,
    default: () => ({}),
  },
  ctaLabel: {
    type: String,
    default: '',
  },
});

const localePath = useLocalePath();
const { locale } = useI18n();
const copy = computed(() => locale.value === 'kk' ? {
  label: 'Бағдарлама таңдау', title: 'Жұмысыңызға сай оқыту',
  text: 'Бағытты, қызметіңізді және оқу форматын таңдаңыз. Қажетті дайындықты анықтап, оқуға өтінім беріңіз.',
} : {
  label: 'Подобрать программу', title: 'Обучение под задачи вашей работы',
  text: 'Выберите направление, свою должность и удобный формат. Подбор поможет определить нужную подготовку и оставить заявку на обучение.',
});
const relatedLinks = computed(() =>
  (props.content.modules.related.links || []).map((link) => ({
    ...link,
    to: { path: localePath(link.to), query: leadContextQuery(props.ctaQuery) },
  })),
);

const programSelectionRoute = computed(() => ({
  path: localePath('/program-selection'),
  query: props.ctaQuery,
}));
</script>

<template>
  <article class="ed-public">
    <EditorialPageHeader :title="content.hero.h1" :lead="content.hero.description">
      <div class="ed-public-actions"><NuxtLink :to="programSelectionRoute" class="ed-public-button">{{ ctaLabel || copy.label }}</NuxtLink><a href="#directions" class="ed-public-link">{{ content.modules.related.title }}</a></div>
    </EditorialPageHeader>
    <div class="ed-public-strips">
      <section id="who-needs"><h2>{{ content.modules.whoNeeds.title }}</h2><ul class="ed-public-list"><li v-for="item in content.modules.whoNeeds.bullets" :key="item">{{ item }}</li></ul></section>
      <section id="scenarios"><h2>{{ content.modules.scenarios.title }}</h2><div class="ed-public-scenarios"><div v-for="item in content.modules.scenarios.items" :key="item.title"><h3>{{ item.title }}</h3><p>{{ item.text }}</p></div></div></section>
      <section id="process"><h2>{{ content.modules.process.title }}</h2><div><ol class="ed-public-list"><li v-for="step in content.modules.process.steps" :key="step.title"><strong>{{ step.title }}.</strong> {{ step.text }}</li></ol><div v-if="content.modules.process.notes?.length"><p v-for="note in content.modules.process.notes" :key="note">{{ note }}</p></div></div></section>
      <section id="questions"><h2>{{ content.modules.faq.title }}</h2><div class="ed-public-faq"><details v-for="item in content.modules.faq.faqs" :key="item.q"><summary>{{ item.q }}</summary><p>{{ item.a }}</p></details></div></section>
      <section id="directions"><h2>{{ content.modules.related.title }}</h2><div class="ed-public-links"><NuxtLink v-for="link in relatedLinks" :key="link.to.path" :to="link.to">{{ link.label }}</NuxtLink></div></section>
    </div>
    <section class="ed-public-callout"><h2>{{ copy.title }}</h2><p>{{ copy.text }}</p><div class="ed-public-actions"><NuxtLink class="ed-public-button" :to="programSelectionRoute">{{ ctaLabel || copy.label }}</NuxtLink></div></section>
  </article>
</template>
