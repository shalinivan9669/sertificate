import { defineNuxtRouteMiddleware, navigateTo } from '#imports';
import { isValidCitySlug } from '../composables/useCity';
import { defaultCitySlug } from '../config/cities';

const FALLBACK_CITY = defaultCitySlug; // change to '/' if нужно отправлять на общую главную

export default defineNuxtRouteMiddleware((to) => {
  const param = to.params?.city;
  if (!param) {
    return;
  }

  const slug = Array.isArray(param) ? param[0] : param;

  if (isValidCitySlug(slug)) {
    return;
  }

  return navigateTo(`/${FALLBACK_CITY}`);
});
