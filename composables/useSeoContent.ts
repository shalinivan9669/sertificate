import { computed, unref, type MaybeRef } from 'vue';
import { useI18n } from '#imports';
import { cities, type CityContent } from '~/content/cities';
import { courses, type CourseContent } from '~/content/courses';
import { buildSeoContent } from '~/content/public-city-content';

export { buildSeoContent } from '~/content/public-city-content';
export type SeoContent = NonNullable<ReturnType<typeof buildSeoContent>>;

export const useSeoContent = (
  cityInput: MaybeRef<CityContent | null | undefined>,
  courseInput?: MaybeRef<CourseContent | null>,
) => {
  const { locale } = useI18n();
  return computed(() => buildSeoContent(unref(cityInput), unref(courseInput), locale.value));
};

export const getCityContentBySlug = (slug: string) => cities.find((city) => city.slug === slug);
export const getCourseContentBySlug = (slug: string) => courses.find((course) => course.slug === slug);
