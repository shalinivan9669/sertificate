import { computed } from 'vue';
import { useRoute } from '#imports';
import { cities } from '../config/cities';

const getCityBySlug = (slug) => cities.find((city) => city.slug === slug) || null;
const isValidCitySlug = (slug) => Boolean(getCityBySlug(slug));

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
  };
}

export { getCityBySlug, isValidCitySlug };
