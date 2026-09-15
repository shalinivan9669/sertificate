<script setup lang="ts">
const { tr } = useLmsApi();
const path = useLocalePath();
const { show: showEditorialMenu } = useEditorialMenu();
const open = ref(false);
const email = ref("");
const answer = ref("");
const selectedFilter = ref("all");
const submitted = ref(false);
const state = ref<
  "empty" | "error" | "saving" | "conflict" | "success" | "loading"
>("empty");
const states = computed(() => [
  { id: "empty", label: tr("Нет данных", "Деректер жоқ"), title: tr("Программы пока не назначены", "Бағдарламалар әзірге тағайындалмаған"), text: tr("Когда обучение будет назначено, здесь появится программа и следующий шаг.", "Оқу тағайындалған кезде осында бағдарлама және келесі қадам пайда болады.") },
  { id: "loading", label: tr("Загрузка", "Жүктелуде"), title: tr("Получаем данные обучения", "Оқу деректерін алып жатырмыз"), text: tr("Список появится после ответа сервера.", "Тізім сервер жауабынан кейін пайда болады.") },
  { id: "saving", label: tr("Сохранение", "Сақталуда"), title: tr("Сохраняем ваш ответ", "Жауабыңызды сақтап жатырмыз"), text: tr("Дождитесь подтверждения перед переходом дальше.", "Келесі қадамға өтпес бұрын растауды күтіңіз.") },
  { id: "error", label: tr("Ошибка", "Қате"), title: tr("Сохранение не подтверждено", "Сақтау расталмады"), text: tr("Ответ остался на экране. Проверьте соединение и повторите сохранение.", "Жауап экранда қалды. Байланысты тексеріп, сақтауды қайталаңыз.") },
  { id: "conflict", label: tr("Конфликт", "Қайшылық"), title: tr("Данные изменились", "Деректер өзгерді"), text: tr("Эта запись обновлена в другом окне. Откройте актуальные данные перед продолжением.", "Бұл жазба басқа терезеде жаңартылған. Жалғастырмас бұрын өзекті деректерді ашыңыз.") },
  { id: "success", label: tr("Успех", "Сәтті"), title: tr("Ответ сохранён", "Жауап сақталды"), text: tr("Можно переходить к следующему вопросу.", "Келесі сұраққа өтуге болады.") },
]);
const activeState = computed(() => states.value.find(item => item.id === state.value));
const palette = computed(() => [
  { name: tr('Основной текст', 'Негізгі мәтін'), token: '--ed-ink', color: '#10262a' },
  { name: tr('Тёмная поверхность', 'Қараңғы бет'), token: '--ed-night', color: '#0b171a' },
  { name: tr('Бумага', 'Қағаз'), token: '--ed-paper', color: '#f5f5f0' },
  { name: tr('Акцент', 'Акцент'), token: '--ed-amber', color: '#efb44c' },
  { name: tr('Второстепенный текст', 'Қосалқы мәтін'), token: '--ed-muted', color: '#526365' },
  { name: tr('Граница', 'Шекара'), token: '--ed-rule', color: '#ccd3cd' },
]);
const lesson = computed(() => ({
  title: tr("Внимание к каждой главе", "Әр тарауға мұқият қараңыз"),
  body: tr(
    "Это демонстрация читательской поверхности. Учебный материал расположен в спокойной колонке, а оглавление помогает вернуться к нужной главе.\n\nВ действующем уроке завершение подтверждается сервером. После сохранения можно продолжить обучение. Изменение ширины экрана не меняет выбранную главу.",
    "Бұл — оқу бетінің үлгісі. Оқу материалы ыңғайлы бағанда орналасады, ал мазмұн қажетті тарауға оралуға көмектеседі.\n\nНақты сабақта аяқтау серверде расталады. Сақтағаннан кейін оқуды жалғастыруға болады. Экран енінің өзгеруі таңдалған тарауды өзгертпейді.",
  ),
  media: [],
}));
useHead(() => ({
  title: "UI kit — OT Center",
  meta: [{ name: "robots", content: "noindex, nofollow" }],
}));
</script>
<template>
  <div class="ed-public ed-kit">
    <EditorialPageHeader :title="tr('Дизайн-система ОТ Центра', 'ОТ Орталығының дизайн жүйесі')" :lead="tr('Живая библиотека типографики, навигации и компонентов действующего сайта.', 'Қолданыстағы сайт типографиясының, навигациясының және компоненттерінің кітапханасы.')">
      <p class="ed-kit-demo">{{ tr('Демонстрационный экран. Формы и учебные состояния на этой странице — локальные примеры; они не отправляют заявки и не изменяют результаты обучения.', 'Демонстрациялық бет. Осы беттегі нысандар мен оқу күйлері — жергілікті үлгілер; олар өтінімдер жібермейді және оқу нәтижелерін өзгертпейді.') }}</p>
    </EditorialPageHeader>
    <div class="ed-kit-grid">
      <section class="ed-kit-block ed-kit-wide">
        <h2>{{ tr('Навигация по задачам', 'Міндеттер бойынша навигация') }}</h2>
        <p>{{ tr('Три раздела: «Программы», «Формат и город», «Центр и помощь». Меню сохраняет выбранный контекст; учебные действия ведут в кабинет.', 'Үш бөлім: «Бағдарламалар», «Формат пен қала», «Орталық және көмек». Мәзір таңдалған параметрлерді сақтайды; оқу әрекеттері кабинетке апарады.') }}</p>
        <EditorialButton @click="showEditorialMenu()">{{ tr('Открыть меню', 'Мәзірді ашу') }}</EditorialButton>
      </section>
      <section class="ed-kit-block ed-kit-wide">
        <h2>{{ tr('Типографика и цвет', 'Типография және түс') }}</h2>
        <div class="ed-kit-type-specimens">
          <div><p class="ed-kit-type-name">OT Display</p><p class="ed-kit-display">{{ tr('Знания для безопасной работы', 'Қауіпсіз жұмысқа арналған білім') }}</p></div>
          <div><p class="ed-kit-type-name">OT Sans</p><p>{{ tr('Понятные действия, читаемые условия, спокойная учебная среда. Основной текст интерфейса — 16 пикселей.', 'Түсінікті әрекеттер, оқуға ыңғайлы шарттар, тыныш оқу ортасы. Интерфейстің негізгі мәтіні — 16 пиксель.') }}</p></div>
        </div>
        <p class="ed-kit-alphabet">Ә ә · Ғ ғ · Қ қ · Ң ң · Ө ө · Ұ ұ · Ү ү · Һ һ · І і<br />«ОТ Центр» — 0123456789 · 10 000 ₸</p>
        <div class="ed-kit-palette">
          <div v-for="color in palette" :key="color.name">
            <div class="ed-kit-swatch" :style="{ background: `var(${color.token})` }" />
            <strong>{{ color.name }}</strong><span>{{ color.color }}</span><code>{{ color.token }}</code>
          </div>
        </div>
      </section>
      <section class="ed-kit-block">
        <h2>{{ tr("Действия", "Әрекеттер") }}</h2>
        <div class="ed-kit-actions">
          <EditorialButton :to="path('/program-selection')">{{
            tr("Подобрать обучение", "Оқуды таңдау")
          }}</EditorialButton
          ><EditorialButton variant="secondary" @click="open = true">{{
            tr("Открыть диалог", "Диалогты ашу")
          }}</EditorialButton
          ><EditorialButton :loading="true">{{
            tr("Сохраняем…", "Сақталуда…")
          }}</EditorialButton
          ><EditorialButton disabled>{{
            tr("Недоступно", "Қолжетімсіз")
          }}</EditorialButton>
        </div>
        <p class="mt-5 text-sm">
          {{
            tr(
              "Наведите указатель, нажмите кнопку или перейдите к ней клавишей Tab.",
              "Меңзерді апарыңыз, батырманы басыңыз немесе Tab пернесімен өтіңіз.",
            )
          }}
        </p>
      </section>
      <section class="ed-kit-block">
        <h2>{{ tr("Фильтры и выбор", "Сүзгілер және таңдау") }}</h2>
        <div class="ed-filters">
          <button
            v-for="filter in ['all', 'online']"
            :key="filter"
            :aria-pressed="selectedFilter === filter"
            @click="selectedFilter = filter"
          >
            {{
              filter === "all"
                ? tr("Все форматы", "Барлық форматтар")
                : tr("Онлайн", "Онлайн")
            }}
          </button>
        </div>
        <fieldset class="mt-6 space-y-3">
          <legend>{{ tr("Демонстрационный вопрос", "Үлгі сұрақ") }}</legend>
          <label
            v-for="option in ['a', 'b']"
            :key="option"
            class="flex gap-3 items-center border p-4"
            ><input
              v-model="answer"
              type="radio"
              name="kit-question"
              :value="option"
            />{{
              option === "a"
                ? tr("Первый вариант ответа", "Бірінші жауап нұсқасы")
                : tr("Второй вариант ответа", "Екінші жауап нұсқасы")
            }}</label
          >
        </fieldset>
      </section>
      <section class="ed-kit-block">
        <h2>{{ tr("Форма и обратная связь", "Нысан және кері байланыс") }}</h2>
        <form class="ed-request-form ed-kit-form" @input="submitted = false" @submit.prevent="submitted = true">
          <label class="block space-y-2"
            ><span>Email</span
            ><input
              v-model="email"
              type="email"
              required
              autocomplete="email"
              placeholder="name@example.com" /></label
          ><EditorialButton type="submit">{{
            tr("Проверить форму", "Нысанды тексеру")
          }}</EditorialButton
          ><EditorialNotice
            v-if="submitted"
            state="success"
            :title="tr('Форма заполнена', 'Нысан толтырылды')"
            ><p>
              {{
                tr(
                  "Это локальный пример. Заявка не отправляется.",
                  "Бұл жергілікті үлгі. Өтінім жіберілмейді.",
                )
              }}
            </p></EditorialNotice
          >
        </form>
      </section>
      <section class="ed-kit-block">
        <h2>{{ tr("Состояния данных", "Деректер күйлері") }}</h2>
        <p class="ed-kit-demo mb-5">{{ tr("Пример сообщения. Выбранное состояние не связано с вашим обучением.", "Хабарлама үлгісі. Таңдалған күй оқуыңызға байланысты емес.") }}</p>
        <label class="block mb-5"
          ><span>{{ tr("Показать состояние", "Күйді көрсету") }}</span
          ><select v-model="state">
            <option v-for="item in states" :key="item.id" :value="item.id">
              {{ item.label }}
            </option>
          </select></label
        ><EditorialNotice
          :state="state"
          :title="activeState?.title || ''"
          ><p>
            {{ activeState?.text }}
          </p></EditorialNotice
        >
        <div class="mt-6">
          <EditorialProgress
            :value="3"
            :max="8"
            :label="
              tr('Пример: изучено 3 из 8 глав', 'Үлгі: 8 тараудың 3-еуі оқылды')
            "
          />
        </div>
      </section>
      <section class="ed-kit-block ed-kit-wide">
        <div class="grid gap-8 md:grid-cols-[220px_1fr]">
          <nav :aria-label="tr('Пример оглавления', 'Мазмұн үлгісі')">
            <p class="ed-kit-type-name">{{ tr("Оглавление примера", "Үлгі мазмұны") }}</p>
            <a href="#kit-lesson" class="ed-text-link"
              >{{ tr("Учебная глава", "Оқу тарауы")
              }}<CivicIcon name="arrow" /></a
            ><NuxtLink :to="path('/courses/ohrana-truda')" class="ed-text-link"
              >{{ tr("Паспорт программы", "Бағдарлама паспорты")
              }}<CivicIcon name="arrow"
            /></NuxtLink>
          </nav>
          <div id="kit-lesson"><LmsLessonContent :lesson="lesson" /></div>
        </div>
      </section>
      <section class="ed-kit-block ed-kit-wide">
        <h2>{{ tr("Реальные экраны", "Нақты беттер") }}</h2>
        <div class="ed-kit-actions">
          <EditorialButton
            v-for="item in [
              { to: '/', ru: 'Обложка', kk: 'Мұқаба' },
              { to: '/courses', ru: 'Каталог', kk: 'Каталог' },
              {
                to: '/courses/ohrana-truda',
                ru: 'Программа',
                kk: 'Бағдарлама',
              },
              { to: '/cabinet', ru: 'Кабинет', kk: 'Жеке кабинет' },
              { to: '/auth/login', ru: 'Вход', kk: 'Кіру' },
              { to: '/b2b', ru: 'Команда', kk: 'Команда' },
            ]"
            :key="item.to"
            :to="path(item.to)"
            variant="secondary"
            >{{ tr(item.ru, item.kk) }}</EditorialButton
          >
        </div>
      </section>
    </div>
    <EditorialDialog
      :open="open"
      :title="tr('Демонстрация диалога', 'Диалог үлгісі')"
      :close-label="tr('Закрыть диалог', 'Диалогты жабу')"
      @close="open = false"
      ><p class="mb-6">
        {{
          tr(
            "Пример подтверждения. Фокус остаётся внутри диалога; Escape закрывает его и возвращает фокус к кнопке.",
            "Растау үлгісі. Фокус диалог ішінде қалады; Escape оны жауып, фокусты батырмаға қайтарады.",
          )
        }}
      </p>
      <EditorialButton @click="open = false">{{
        tr("Понятно", "Түсінікті")
      }}</EditorialButton></EditorialDialog
    >
  </div>
</template>

<style scoped>
.ed-kit-grid { margin-top: 36px; }
.ed-kit-demo { max-width: 82ch; padding-left: 16px; border-left: 3px solid var(--ed-amber); color: var(--ed-muted); font-size: 14px; line-height: 1.7; }
.ed-kit-block > p { color: var(--ed-muted); margin-bottom: 22px; max-width: 78ch; }
.ed-kit-type-specimens { display: grid; grid-template-columns: 1.1fr 1fr; gap: 40px; margin: 28px 0; }
.ed-kit-type-name { margin-bottom: 12px; font: 600 14px/1.5 var(--ed-sans); color: var(--ed-muted); }
.ed-kit-display { font: 500 clamp(32px, 3.2vw, 46px)/1.15 var(--ed-display); letter-spacing: -.03em; max-width: 20ch; }
.ed-kit-alphabet { font-size: 20px; line-height: 1.9; }
.ed-kit-palette { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.ed-kit-palette :is(strong, span, code) { display: block; overflow-wrap: anywhere; }
.ed-kit-palette strong { font-size: 14px; font-weight: 600; }
.ed-kit-palette :is(span, code) { color: var(--ed-muted); font-size: 13px; margin-top: 4px; }
.ed-kit-form { grid-template-columns: minmax(0, 1fr); }
.ed-kit label > :is(input:not([type=radio]), select) { width: 100%; min-height: 48px; margin-top: 8px; padding: 12px 14px; border: 1px solid var(--ed-field); border-radius: var(--ed-radius); background: #fff; font: 400 16px/1.5 var(--ed-sans); color: var(--ed-ink); }
.ed-kit input[type=radio] { width: 20px; height: 20px; accent-color: var(--ed-ink); }
.ed-kit legend { margin-bottom: 12px; }
@media(max-width: 760px) { .ed-kit-type-specimens { grid-template-columns: minmax(0, 1fr); gap: 24px; } .ed-kit-palette { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
