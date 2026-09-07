<script setup lang="ts">
const { api, request, tr, errorText } = useLmsApi();
const { data, pending, error, refresh } = await useAsyncData(
  "lms-security",
  () => api<any>("/me"),
);
const password = ref("");
const code = ref("");
const setup = ref<any>(null);
const busy = ref(false);
const failure = ref("");
const message = ref("");
const acknowledge = ref(false);
async function action(kind: "enable" | "verify-totp" | "disable") {
  busy.value = true;
  failure.value = "";
  message.value = "";
  try {
    const result = await request<any>("/api/auth/two-factor/" + kind, {
      method: "POST",
      body:
        kind === "verify-totp"
          ? { code: code.value }
          : { password: password.value, issuer: "OT Center" },
    });
    if (kind === "enable") setup.value = result;
    else {
      setup.value = null;
      password.value = "";
      code.value = "";
      message.value = tr(
        "Настройки безопасности сохранены.",
        "Қауіпсіздік баптаулары сақталды.",
      );
      await refresh();
    }
  } catch (e) {
    failure.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
useHead(() => ({
  title: tr(
    "Безопасность аккаунта — OT Center",
    "Аккаунт қауіпсіздігі — OT Center",
  ),
  meta: [{ name: "robots", content: "noindex, nofollow" }],
}));
</script>
<template>
  <LmsShell
    :title="tr('Безопасность аккаунта', 'Аккаунт қауіпсіздігі')"
    back="/cabinet"
    ><LmsState :pending="pending" :error="error" @retry="refresh"
      ><div v-if="data?.user" class="lms-card max-w-2xl space-y-5">
        <h2 class="text-xl font-semibold">
          {{
            tr("Двухфакторная аутентификация", "Екі факторлы аутентификация")
          }}
        </h2>
        <p>
          {{
            data.user.twoFactorEnabled
              ? tr(
                  "Включена. Для входа нужен пароль и код приложения.",
                  "Қосылған. Кіру үшін құпиясөз және қолданба коды қажет.",
                )
              : tr(
                  "Добавьте код приложения к паролю для защиты аккаунта. Для административных операций это обязательно.",
                  "Аккаунтты қорғау үшін құпиясөзге қолданба кодын қосыңыз. Әкімшілік әрекеттер үшін бұл міндетті.",
                )
          }}
        </p>
        <form
          v-if="data.user.twoFactorEnabled"
          class="space-y-4 rounded-xl border p-4"
          @submit.prevent="action('verify-totp')"
        >
          <h3 class="font-semibold">
            {{ tr("Подтвердить текущий сеанс", "Ағымдағы сеансты растау") }}
          </h3>
          <label class="block space-y-2"
            ><span>{{ tr("Код приложения", "Қолданба коды") }}</span
            ><input
              v-model="code"
              required
              inputmode="numeric"
              pattern="[0-9]{6}"
              maxlength="6"
              autocomplete="one-time-code" /></label
          ><button class="lms-button" :disabled="busy">
            {{ tr("Подтвердить вход", "Кіруді растау") }}
          </button>
        </form>
        <form
          v-if="!setup"
          class="space-y-4"
          @submit.prevent="
            action(data.user.twoFactorEnabled ? 'disable' : 'enable')
          "
        >
          <label class="block space-y-2"
            ><span>{{ tr("Текущий пароль", "Ағымдағы құпиясөз") }}</span
            ><input
              v-model="password"
              required
              type="password"
              autocomplete="current-password" /></label
          ><label
            v-if="data.user.twoFactorEnabled"
            class="flex items-start gap-3"
            ><input
              v-model="acknowledge"
              type="checkbox"
              required
              class="mt-1"
            /><span>{{
              tr(
                "Отключить дополнительную защиту аккаунта.",
                "Аккаунттың қосымша қорғанысын өшіру.",
              )
            }}</span></label
          ><button class="lms-button" :disabled="busy">
            {{
              data.user.twoFactorEnabled
                ? tr(
                    "Отключить двухфакторную защиту",
                    "Екі факторлы қорғауды өшіру",
                  )
                : tr("Настроить приложение", "Қолданбаны баптау")
            }}
          </button>
        </form>
        <div v-else class="space-y-5">
          <p>
            {{
              tr(
                "Добавьте этот секретный URI в приложение аутентификации. Не передавайте его другим людям.",
                "Осы құпия URI-ді аутентификация қолданбасына қосыңыз. Оны басқа адамдарға бермеңіз.",
              )
            }}
          </p>
          <code class="block break-all rounded-xl bg-slate-100 p-4 text-sm">{{
            setup.totpURI
          }}</code>
          <details
            v-if="setup.backupCodes?.length"
            class="rounded-xl border p-4"
          >
            <summary class="cursor-pointer font-semibold">
              {{
                tr(
                  "Резервные коды — сохраните в безопасном месте",
                  "Резервтік кодтар — қауіпсіз жерде сақтаңыз",
                )
              }}
            </summary>
            <ul class="mt-3 space-y-2 font-mono">
              <li v-for="backup in setup.backupCodes" :key="backup">
                {{ backup }}
              </li>
            </ul>
          </details>
          <form class="space-y-4" @submit.prevent="action('verify-totp')">
            <label class="block space-y-2"
              ><span>{{ tr("Код из приложения", "Қолданбадағы код") }}</span
              ><input
                v-model="code"
                required
                inputmode="numeric"
                pattern="[0-9]{6}"
                maxlength="6"
                autocomplete="one-time-code" /></label
            ><button class="lms-button" :disabled="busy">
              {{ tr("Подтвердить и включить", "Растау және қосу") }}
            </button>
          </form>
        </div>
        <p v-if="failure" class="lms-error" role="alert">{{ failure }}</p>
        <p v-if="message" class="lms-success" role="status">{{ message }}</p>
      </div></LmsState
    ><LmsPreferences v-if="data?.user"
  /></LmsShell>
</template>
