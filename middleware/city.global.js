import { createError, defineNuxtRouteMiddleware } from '#imports';
import { isValidCitySlug } from '../composables/useCity';

export default defineNuxtRouteMiddleware((to) => {
  const param = to.params?.city;
  if (!param) {
    return;
  }

  const slug = Array.isArray(param) ? param[0] : param;

  if (isValidCitySlug(slug)) {
    return;
  }

  throw createError({ statusCode: 404, statusMessage: 'City not found' });
});
