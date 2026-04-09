# Редизайн страниц — Маппинг на Nuxt маршруты

Каждая папка содержит:
- `index.html` — HTML-макет с Tailwind (исходник дизайна)
- `screen.png` — скриншот страницы

---

## Страницы и маршруты

| Папка | Nuxt файл | Маршрут | Описание |
|-------|-----------|---------|----------|
| `01_index` | `pages/index.vue` | `/` | Публичная главная страница |
| `02_categories` | `pages/courses/index.vue` | `/courses` | Каталог категорий курсов |
| `03_wizard` | `pages/wizard.vue` | `/wizard` | Мастер подбора курса |
| `04_catalog` | `pages/[city]/index.vue` | `/:city` | Каталог курсов по городу |
| `05_course` | `pages/[city]/[course].vue` | `/:city/:course` | Детальная страница курса |
| `06_learning` | `pages/learn/[id].vue` | `/learn/:id` | Интерфейс обучения (модули) |
| `07_pre-test-confirm` | `pages/learn/[id]/confirm.vue` | `/learn/:id/confirm` | Юридическое подтверждение перед тестом |
| `08_pre-test` | `pages/learn/[id]/pre-test.vue` | `/learn/:id/pre-test` | Подготовка к тестированию |
| `09_exam` | `pages/learn/[id]/exam.vue` | `/learn/:id/exam` | Интерфейс тестирования |
| `10_result-failed` | `pages/learn/[id]/failed.vue` | `/learn/:id/failed` | Результат: тест не пройден |
| `11_payment` | `pages/payment/[courseId].vue` | `/payment/:courseId` | Оплата курса |
| `12_result-success` | `pages/learn/[id]/success.vue` | `/learn/:id/success` | Результат: тест пройден |
| `13_certificate` | `pages/certificates/[id].vue` | `/certificates/:id` | Выдача удостоверения/сертификата |
| `14_payment-pending` | `pages/payment/pending.vue` | `/payment/pending` | Ожидание обработки платежа |
| `15_overview` | `pages/cabinet/index.vue` | `/cabinet` | Личный кабинет (обзор) |
| `16_b2b` | `pages/b2b.vue` | `/b2b` | Корпоративная страница (B2B) |

---

## Дизайн-система

Документ `design/DESIGN.md` описывает:
- **Цветовая палитра:** Deep Navy `#0A192F` / Active Blue `#4A90E2` / Dark Graphite `#2D3436`
- **Шрифты:** Manrope (заголовки) + Inter (текст/UI)
- **Стиль:** "Premium Industrial" — без скруглённых бабл-элементов, тональные переходы вместо рамок
- **Тени:** всегда с оттенком Navy, никогда чистый `#000`

---

## Поток пользователя

```
01_index → 03_wizard → 04_catalog → 05_course → 11_payment
                                                     ↓
                                              14_payment-pending
                                                     ↓
                                              06_learning → 07_pre-test-confirm
                                                                    ↓
                                                             08_pre-test → 09_exam
                                                                              ↓
                                                             10_result-failed  12_result-success
                                                                                      ↓
                                                                               13_certificate
                                                                               15_overview (кабинет)
```
