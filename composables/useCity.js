import { computed } from 'vue';
import { useRoute } from '#imports';
import { cities } from '../config/cities';

const getCityBySlug = (slug) => cities.find((city) => city.slug === slug) || null;
const isValidCitySlug = (slug) => Boolean(getCityBySlug(slug));
const getCityName = (city, locale = 'ru') => {
  if (!city) return null;
  if (locale === 'kk') {
    return city.nameKk || city.nameRu;
  }
  return city.nameRu;
};
const getCityPrepositional = (city, locale = 'ru') => {
  if (!city) return null;
  if (locale === 'kk') {
    return city.nameKkPrepositional || city.nameKk || city.nameRuPrepositional || city.nameRu;
  }
  return city.nameRuPrepositional || city.nameRu;
};

export default function useCity() {
  const route = useRoute();

  const currentCity = computed(() => {
    const slug = route.params?.city;
    if (!slug || Array.isArray(slug)) {
      return null;
    }
    return getCityBySlug(slug) || null;
  });

  return {
    city: currentCity,
    allCities: computed(() => cities),
    getCityBySlug,
    isValidCitySlug,
    getCityName,
    getCityPrepositional,
  };
}

export { getCityBySlug, isValidCitySlug, getCityName, getCityPrepositional };
