<script setup lang="ts">
const { tr } = useLmsApi();
const { consented, config, configPending, configError, enabled, loadConfig, optIn, withdraw } = useLmsAnalytics();
const message = ref('');
onMounted(() => { void loadConfig(); });
function accept() {
  if (optIn()) message.value = tr('Статистика разрешена для этой сессии браузера.', 'Статистикаға осы браузер сессиясы үшін рұқсат берілді.');
}
function decline() {
  withdraw();
  message.value = tr('Статистика выключена. Очередь неотправленных событий очищена.', 'Статистика өшірілді. Жіберілмеген оқиғалар кезегі тазартылды.');
}
</script>
<template>
  <section class="analytics-consent space-y-4 rounded-xl border border-slate-200 bg-white p-6" :aria-label="tr('Необязательная статистика сайта', 'Сайттың міндетті емес статистикасы')">
    <h2 class="text-xl font-semibold text-slate-900">{{ tr('Необязательная статистика сайта', 'Сайттың міндетті емес статистикасы') }}</h2>
    <p class="text-sm text-slate-600">{{ tr('По вашему выбору сайт может отправлять на собственный сервер статистику открытия программ, подбора, обращения, записи и уроков. В эти события входят только направление, язык, город из списка, формат и тип обращения. Имена, контакты, тексты заявок, ответы экзамена и идентификаторы пользователей в них не передаются.', 'Сіздің таңдауыңызбен сайт өз серверіне бағдарламаларды ашу, таңдау, байланысу, жазылу және сабақтар туралы статистика жібере алады. Бұл оқиғаларға тек бағыт, тіл, тізімдегі қала, формат және өтініш түрі кіреді. Аты-жөн, байланыс деректері, өтінім мәтіндері, емтихан жауаптары және пайдаланушы идентификаторлары берілмейді.') }}</p>
    <p class="text-sm text-slate-600">{{ tr('Это отдельный выбор от подписки на новости. Сайт и обучение доступны при отказе. Согласие хранится в session-cookie этого браузера; его можно отозвать здесь или в настройках кабинета. Внешние платформы аналитики не подключены.', 'Бұл жаңалықтарға жазылудан бөлек таңдау. Бас тартқанда сайт пен оқу қолжетімді болып қалады. Келісім осы браузердің session-cookie файлында сақталады; оны осы жерден немесе кабинет баптауларынан қайтарып алуға болады. Сыртқы аналитика платформалары қосылмаған.') }}</p>
    <p v-if="configPending" role="status">{{ tr('Проверяем доступность статистики…', 'Статистиканың қолжетімділігін тексеріп жатырмыз…') }}</p>
    <div v-else-if="configError" class="space-y-2">
      <p role="alert">{{ tr('Не удалось проверить настройки. Новое согласие пока недоступно.', 'Баптауларды тексеру мүмкін болмады. Жаңа келісім әзірге қолжетімсіз.') }}</p>
      <button type="button" class="analytics-action" @click="loadConfig(true)">{{ tr('Повторить проверку настроек', 'Баптауларды қайта тексеру') }}</button>
    </div>
    <p v-else-if="enabled" class="text-sm">{{ tr('Окно хранения статистики в настройках:', 'Баптаулардағы статистиканы сақтау аралығы:') }} {{ config?.retentionDays }} {{ tr('дней. Очистка выполняется отдельным серверным заданием.', 'күн. Тазалау бөлек серверлік тапсырмамен орындалады.') }}</p>
    <p v-else class="text-sm">{{ tr('Сбор статистики сейчас выключен в настройках сайта.', 'Статистика жинау қазір сайт баптауларында өшірілген.') }}</p>
    <p class="text-sm font-semibold" role="status">{{ consented ? tr('Ваш выбор: статистика разрешена.', 'Сіздің таңдауыңыз: статистикаға рұқсат берілген.') : tr('Ваш выбор: статистика выключена.', 'Сіздің таңдауыңыз: статистика өшірулі.') }}</p>
    <div class="flex flex-wrap gap-3">
      <button v-if="!consented" type="button" class="analytics-action" :disabled="!enabled || configPending || configError" @click="accept">{{ tr('Разрешить статистику', 'Статистикаға рұқсат беру') }}</button>
      <button type="button" class="analytics-action secondary" @click="decline">{{ consented ? tr('Отозвать согласие на статистику', 'Статистикаға келісімді қайтарып алу') : tr('Оставить выключенной', 'Өшірулі қалдыру') }}</button>
    </div>
    <p v-if="message" class="text-sm" role="status">{{ message }}</p>
  </section>
</template>
<style scoped>
.analytics-action { min-height: 44px; padding: .65rem 1rem; border: 1px solid #2b7a78; border-radius: .65rem; color: white; background: #2b7a78; font-weight: 600; }
.analytics-action.secondary { color: #0f172a; background: white; border-color: #94a3b8; }
.analytics-action:disabled { opacity: .55; cursor: not-allowed; }
.analytics-action:focus-visible { outline: 3px solid #2b7a78; outline-offset: 3px; }
</style>
