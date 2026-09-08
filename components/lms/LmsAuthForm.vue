<script setup lang="ts">
const props = defineProps<{
  mode: "login" | "signup" | "forgot" | "reset" | "verify" | "mfa";
}>();
const { tr, locale, request, errorText } = useLmsApi();
const attribution = useLeadAttribution();
const path = useLocalePath();
const route = useRoute();
const busy = ref(false);
const failure = ref("");
const message = ref("");
const name = ref("");
const email = ref("");
const password = ref("");
const code = ref("");
const consent = ref(false);
const {
  data: authConfig,
  error: configError,
  refresh: refreshConfig,
} = await useAsyncData("lms-auth-config", () =>
  request<{ available: boolean; emailDeliveryConfigured: boolean }>(
    "/api/v1/auth/config",
  ),
);
const destination = computed(() =>
  safeLmsReturnTo(route.query.returnTo, path("/cabinet")),
);
const showEmailHelp = computed(() =>
  authConfig.value?.available &&
  !authConfig.value.emailDeliveryConfigured &&
  ["login", "signup", "forgot", "verify"].includes(props.mode) &&
  !(props.mode === "verify" && route.query.token),
);
const title = computed(
  () =>
    ({
      login: tr("Вход в личный кабинет", "Жеке кабинетке кіру"),
      signup: tr("Создать аккаунт", "Аккаунт ашу"),
      forgot: tr("Восстановление доступа", "Қолжетімділікті қалпына келтіру"),
      reset: tr("Новый пароль", "Жаңа құпиясөз"),
      verify: tr(
        "Подтверждение электронной почты",
        "Электрондық поштаны растау",
      ),
      mfa: tr("Подтверждение входа", "Кіруді растау"),
    })[props.mode],
);
useHead(() => ({
  title: `${title.value} — OT Center`,
  meta: [{ name: "robots", content: "noindex, nofollow" }],
}));
async function submit() {
  if (busy.value) return;
  busy.value = true;
  failure.value = "";
  message.value = "";
  if (props.mode === 'login' || props.mode === 'signup') void attribution.action('auth_start', { routeId: props.mode === 'login' ? 'auth_login' : 'auth_signup', locale: locale.value === 'kk' ? 'kk' : 'ru', source: 'internal' }).catch(() => {});
  try {
    if (props.mode === "login") {
      const result = await request<any>("/api/auth/sign-in/email", {
        method: "POST",
        body: {
          email: email.value,
          password: password.value,
          callbackURL: destination.value,
        },
      });
      if (result.twoFactorRedirect)
        await navigateTo({
          path: path("/auth/mfa"),
          query: { returnTo: destination.value },
        });
      else {
        void attribution.authenticated().catch(() => {});
        await navigateTo(destination.value);
      }
    } else if (props.mode === "signup") {
      await request("/api/auth/sign-up/email", {
        method: "POST",
        body: {
          name: name.value,
          email: email.value,
          password: password.value,
          callbackURL:
            path("/auth/verify") +
            "?returnTo=" +
            encodeURIComponent(destination.value),
        },
      });
      message.value = authConfig.value?.emailDeliveryConfigured
        ? tr(
            "Аккаунт создан. Подтвердите почту по ссылке из письма, затем войдите.",
            "Аккаунт ашылды. Хаттағы сілтеме арқылы поштаңызды растап, жүйеге кіріңіз.",
          )
        : tr(
            "Аккаунт создан. Подтверждение почты через письмо сейчас недоступно. Для записи на обучение свяжитесь с учебным центром.",
            "Аккаунт ашылды. Поштаны хат арқылы растау қазір қолжетімсіз. Оқуға жазылу үшін оқу орталығына хабарласыңыз.",
          );
    } else if (props.mode === "forgot") {
      await request("/api/auth/request-password-reset", {
        method: "POST",
        body: { email: email.value, redirectTo: path("/auth/reset") },
      });
      message.value = authConfig.value?.emailDeliveryConfigured
        ? tr(
            "Если адрес зарегистрирован, инструкция по восстановлению будет отправлена на почту.",
            "Мекенжай тіркелген болса, қалпына келтіру нұсқаулығы поштаға жіберіледі.",
          )
        : tr(
            "Запрос принят. Восстановление через письмо сейчас недоступно. Свяжитесь с учебным центром для помощи со входом.",
            "Сұрау қабылданды. Хат арқылы қалпына келтіру қазір қолжетімсіз. Кіруге көмек алу үшін оқу орталығына хабарласыңыз.",
          );
    } else if (props.mode === "reset") {
      await request("/api/auth/reset-password", {
        method: "POST",
        body: {
          token: String(route.query.token || ""),
          newPassword: password.value,
        },
      });
      message.value = tr(
        "Пароль изменён. Войдите с новым паролем.",
        "Құпиясөз өзгертілді. Жаңа құпиясөзбен кіріңіз.",
      );
    } else if (props.mode === "verify") {
      if (route.query.token) {
        await request("/api/auth/verify-email", {
          query: { token: String(route.query.token) },
        });
        message.value = tr(
          "Почта подтверждена. Теперь можно войти.",
          "Пошта расталды. Енді жүйеге кіре аласыз.",
        );
      } else {
        await request("/api/auth/send-verification-email", {
          method: "POST",
          body: {
            email: email.value,
            callbackURL:
              path("/auth/verify") +
              "?returnTo=" +
              encodeURIComponent(destination.value),
          },
        });
        message.value = authConfig.value?.emailDeliveryConfigured
          ? tr(
              "Если подтверждение требуется, письмо будет отправлено. Проверьте почту.",
              "Растау қажет болса, хат жіберіледі. Поштаңызды тексеріңіз.",
            )
          : tr(
              "Запрос принят. Подтверждение почты через письмо сейчас недоступно. Свяжитесь с учебным центром.",
              "Сұрау қабылданды. Поштаны хат арқылы растау қазір қолжетімсіз. Оқу орталығына хабарласыңыз.",
            );
      }
    } else {
      await request("/api/auth/two-factor/verify-totp", {
        method: "POST",
        body: { code: code.value, trustDevice: false },
      });
      void attribution.authenticated().catch(() => {});
      await navigateTo(destination.value);
    }
  } catch (error) {
    failure.value =
      props.mode === "login" && lmsErrorStatus(error) !== 429
        ? tr(
            "Не удалось войти. Проверьте почту, пароль и подтверждение адреса.",
            "Кіру мүмкін болмады. Поштаны, құпиясөзді және мекенжай растауын тексеріңіз.",
          )
        : errorText(error);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <LmsShell :title="title"
    ><div class="lms-card mx-auto max-w-xl space-y-6">
      <p
        v-if="authConfig && !authConfig.available"
        class="lms-note"
        role="status"
      >
        {{
          tr(
            "Сервис аккаунтов временно недоступен. Обратитесь в учебный центр или повторите позже.",
            "Аккаунт қызметі уақытша қолжетімсіз. Оқу орталығына хабарласыңыз немесе кейінірек қайталаңыз.",
          )
        }}
      </p>
      <div v-else-if="showEmailHelp" class="lms-note space-y-3">
        <p>
          {{ mode === 'login'
            ? tr(
              'Вход доступен для активированных аккаунтов. Подтверждение почты и восстановление через письмо временно недоступны. Если нужна помощь со входом, свяжитесь с учебным центром.',
              'Белсендірілген аккаунттармен кіруге болады. Поштаны растау және хат арқылы қалпына келтіру уақытша қолжетімсіз. Кіруге көмек қажет болса, оқу орталығына хабарласыңыз.',
            )
            : tr(
              'Подтверждение почты и восстановление через письмо временно недоступны. Сохранение аккаунта само по себе не открывает доступ к обучению. Для записи свяжитесь с учебным центром.',
              'Поштаны растау және хат арқылы қалпына келтіру уақытша қолжетімсіз. Аккаунтты сақтау оқуға автоматты түрде қолжетімділік бермейді. Оқуға жазылу үшін оқу орталығына хабарласыңыз.',
            )
          }}
        </p>
        <div class="flex flex-wrap gap-x-5 gap-y-2 font-semibold">
          <NuxtLink :to="path('/contacts')" class="underline underline-offset-4">{{ tr('Связаться с учебным центром', 'Оқу орталығына хабарласу') }}</NuxtLink>
          <NuxtLink :to="path('/courses')" class="underline underline-offset-4">{{ tr('Посмотреть курсы', 'Курстарды қарау') }}</NuxtLink>
        </div>
      </div>
      <LmsState
        v-if="configError"
        :error="configError"
        @retry="refreshConfig"
      />
      <p v-if="mode === 'mfa'" class="text-slate-600">
        {{
          tr(
            "Введите текущий код из приложения для двухфакторной аутентификации.",
            "Екі факторлы аутентификация қолданбасындағы ағымдағы кодты енгізіңіз.",
          )
        }}
      </p>
      <p v-if="mode === 'reset' && !route.query.token" class="lms-error">
        {{
          tr(
            "В ссылке отсутствует токен. Запросите новое письмо восстановления.",
            "Сілтемеде токен жоқ. Жаңа қалпына келтіру хатын сұратыңыз.",
          )
        }}
      </p>
      <form class="space-y-5" @submit.prevent="submit">
        <label v-if="mode === 'signup'" class="block space-y-2"
          ><span>{{ tr("Имя и фамилия", "Аты-жөні") }}</span
          ><input
            v-model="name"
            required
            autocomplete="name"
            maxlength="150"
            :disabled="busy"
        /></label>
        <label
          v-if="
            ['login', 'signup', 'forgot'].includes(mode) ||
            (mode === 'verify' && !route.query.token)
          "
          class="block space-y-2"
          ><span>Email</span
          ><input
            v-model="email"
            required
            type="email"
            autocomplete="email"
            maxlength="254"
            :disabled="busy"
            :aria-describedby="failure ? 'auth-error' : undefined"
        /></label>
        <label
          v-if="['login', 'signup', 'reset'].includes(mode)"
          class="block space-y-2"
          ><span>{{ tr("Пароль", "Құпиясөз") }}</span
          ><input
            v-model="password"
            required
            type="password"
            :minlength="mode === 'login' ? undefined : 12"
            maxlength="128"
            :autocomplete="
              mode === 'login' ? 'current-password' : 'new-password'
            "
            :disabled="busy"
            :aria-describedby="failure ? 'auth-error' : undefined"
          /><small v-if="mode !== 'login'">{{
            tr("Не менее 12 символов.", "Кемінде 12 таңба.")
          }}</small></label
        >
        <label v-if="mode === 'mfa'" class="block space-y-2"
          ><span>{{ tr("Код подтверждения", "Растау коды") }}</span
          ><input
            v-model="code"
            required
            inputmode="numeric"
            autocomplete="one-time-code"
            pattern="[0-9]{6}"
            maxlength="6"
            :disabled="busy"
        /></label>
        <label v-if="mode === 'signup'" class="flex items-start gap-3 text-sm"
          ><input
            v-model="consent"
            type="checkbox"
            required
            class="mt-1"
          /><span
            >{{ tr("Я ознакомился(-ась) с", "Мен таныстым:") }}
            <NuxtLink :to="path('/privacy')">{{
              tr("политикой конфиденциальности", "құпиялылық саясаты")
            }}</NuxtLink>
            {{ tr("и условиями", "және") }}
            <NuxtLink :to="path('/public-offer')">{{
              tr("оферты", "оферта шарттары")
            }}</NuxtLink
            >.</span
          ></label
        >
        <p v-if="failure" id="auth-error" class="lms-error" role="alert">
          {{ failure }}
        </p>
        <p v-if="message" class="lms-success" role="status">{{ message }}</p>
        <button
          class="lms-button w-full"
          :disabled="
            busy ||
            authConfig?.available === false ||
            (mode === 'reset' && !route.query.token)
          "
        >
          {{
            busy
              ? tr("Отправляем…", "Жіберілуде…")
              : mode === "verify"
                ? route.query.token
                  ? tr("Подтвердить почту", "Поштаны растау")
                  : tr("Отправить письмо подтверждения", "Растау хатын жіберу")
                : title
          }}
        </button>
      </form>
      <div class="flex flex-wrap gap-x-5 gap-y-3 text-sm">
        <NuxtLink
          v-if="mode !== 'login'"
          :to="{ path: path('/auth/login'), query: { returnTo: destination } }"
          >{{ tr("Войти", "Кіру") }}</NuxtLink
        ><NuxtLink
          v-if="mode === 'login'"
          :to="{ path: path('/auth/signup'), query: { returnTo: destination } }"
          >{{ tr("Создать аккаунт", "Аккаунт ашу") }}</NuxtLink
        ><NuxtLink
          v-if="['login', 'reset'].includes(mode)"
          :to="path('/auth/forgot')"
          >{{ tr("Забыли пароль?", "Құпиясөзді ұмыттыңыз ба?") }}</NuxtLink
        ><NuxtLink v-if="mode === 'login'" :to="path('/auth/verify')">{{
          tr("Подтвердить почту", "Поштаны растау")
        }}</NuxtLink>
      </div>
    </div></LmsShell
  >
</template>
