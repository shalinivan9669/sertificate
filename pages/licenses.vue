<script setup>
import { licenseDownloadFiles } from '~/config/licenses-files';
const publishedDocument = licenseDownloadFiles.find(item => item?.file === '/documents/licenses/KZ07VEK00018551_ru.pdf');
const { locale } = useI18n();
const path = useLocalePath();
const tr = (ru, kk) => locale.value === 'kk' ? kk : ru;
useHead(() => ({ title: tr('Сведения и документы учебного центра', 'Оқу орталығы туралы мәліметтер мен құжаттар'), meta: [{ name: 'description', content: tr('Как запросить сведения о документах учебного центра и уточнить условия выбранной программы перед обучением.', 'Оқу орталығының құжаттары туралы мәліметтерді сұрату және оқу алдында таңдалған бағдарламаның шарттарын нақтылау.') }] }));
</script>

<template>
  <div class="ed-public">
    <EditorialPageHeader :title="tr('Сведения и документы центра', 'Орталық туралы мәліметтер мен құжаттар')" :lead="tr('Перед обучением уточните основания проведения программы, условия проверки знаний и состав документов по её завершении.', 'Оқу алдында бағдарламаны өткізу негіздерін, білімді тексеру шарттарын және оны аяқтағаннан кейінгі құжаттар құрамын нақтылаңыз.')">
      <div class="ed-public-actions"><NuxtLink :to="path('/contacts')" class="ed-public-button">{{ tr('Запросить сведения', 'Мәліметтерді сұрату') }}</NuxtLink></div>
    </EditorialPageHeader>
    <section v-if="publishedDocument" class="ed-license-document" aria-labelledby="published-document-title">
      <a v-if="publishedDocument.preview" :href="publishedDocument.file" target="_blank" rel="noopener noreferrer" class="ed-license-preview" :aria-label="tr('Открыть аттестат KZ07VEK00018551 в PDF', 'KZ07VEK00018551 аттестатын PDF форматында ашу')"><ResponsiveImage sizes="(max-width: 639px) calc(100vw - 40px), 527px" :src="publishedDocument.preview" :alt="tr('Первая страница аттестата KZ07VEK00018551', 'KZ07VEK00018551 аттестатының бірінші беті')" width="527" height="745" loading="lazy" /></a>
      <div>
        <p class="ed-license-type">{{ tr('Опубликованный документ', 'Жарияланған құжат') }}</p>
        <h2 id="published-document-title">{{ tr('Аттестат на право проведения работ в области промышленной безопасности', 'Өнеркәсіптік қауіпсіздік саласында жұмыстар жүргізу құқығына аттестат') }}</h2>
        <dl class="ed-license-facts">
          <div><dt>{{ tr('Номер и дата выдачи', 'Нөмірі және берілген күні') }}</dt><dd>KZ07VEK00018551 · 09.02.2026</dd></div>
          <div><dt>{{ tr('Кому выдан', 'Кімге берілген') }}</dt><dd>{{ tr('ТОО «Аттестационный центр Стандарт»', '«Аттестационный центр Стандарт» ЖШС') }}</dd></div>
          <div><dt>{{ tr('Область работ', 'Жұмыстар саласы') }}</dt><dd>{{ tr('Подготовка и переподготовка руководителей, специалистов и работников в области промышленной безопасности.', 'Өнеркәсіптік қауіпсіздік саласында басшыларды, мамандарды және жұмыскерлерді даярлау және қайта даярлау.') }}</dd></div>
          <div><dt>{{ tr('Выдавший орган', 'Берген орган') }}</dt><dd>{{ tr('Комитет промышленной безопасности Министерства по чрезвычайным ситуациям Республики Казахстан.', 'Қазақстан Республикасы Төтенше жағдайлар министрлігінің Өнеркәсіптік қауіпсіздік комитеті.') }}</dd></div>
          <div><dt>{{ tr('Срок, указанный в документе', 'Құжатта көрсетілген мерзім') }}</dt><dd>{{ tr('Пять лет', 'Бес жыл') }}</dd></div>
        </dl>
        <div class="ed-public-actions"><a :href="publishedDocument.file" target="_blank" rel="noopener noreferrer" class="ed-public-button">{{ tr('Открыть PDF', 'PDF ашу') }}</a><a :href="publishedDocument.file" download class="ed-public-link">{{ tr('Скачать документ', 'Құжатты жүктеу') }}</a></div>
        <p class="ed-license-note">{{ tr('Сведения приведены по опубликованному аттестату. Его подлинность можно проверить по номеру на портале eLicense, указанном в самом документе. Для выбранной программы уточните применимые документы и условия в центре.', 'Мәліметтер жарияланған аттестаттан алынды. Түпнұсқалығын құжатта көрсетілген eLicense порталында нөмірі бойынша тексеруге болады. Таңдалған бағдарламаға қатысты құжаттар мен шарттарды орталықтан нақтылаңыз.') }}</p>
      </div>
    </section>
    <div class="ed-public-strips">
      <section><h2>{{ tr('Что можно уточнить', 'Нені нақтылауға болады') }}</h2><div><p>{{ tr('В обращении укажите название программы и задачу организации. Это поможет определить, какие сведения нужны именно для вашего обучения.', 'Өтініште бағдарлама атауын және ұйымның міндетін көрсетіңіз. Бұл оқуыңызға қандай мәліметтер қажет екенін анықтауға көмектеседі.') }}</p><ul class="ed-public-list"><li>{{ tr('Сведения об учебном центре и документах, на основании которых проводится выбранное обучение.', 'Оқу орталығы туралы және таңдалған оқытуды өткізуге негіз болатын құжаттар туралы мәліметтер.') }}</li><li>{{ tr('Содержание, продолжительность и допустимые форматы программы.', 'Бағдарламаның мазмұны, ұзақтығы және рұқсат етілген форматтары.') }}</li><li>{{ tr('Порядок проверки знаний и условия оформления итоговых документов.', 'Білімді тексеру тәртібі және қорытынды құжаттарды рәсімдеу шарттары.') }}</li></ul></div></section>

      <section><h2>{{ tr('Условия и личные документы', 'Шарттар және жеке құжаттар') }}</h2><div><p>{{ tr('Условия оказания услуг и обработки данных доступны в правовых документах сайта. Выданные вам по итогам обучения документы можно найти в личном кабинете.', 'Қызмет көрсету және деректерді өңдеу шарттары сайттың құқықтық құжаттарында берілген. Оқу қорытындысы бойынша сізге берілген құжаттарды жеке кабинеттен табуға болады.') }}</p><div class="ed-public-links"><NuxtLink :to="path('/public-offer')">{{ tr('Публичная оферта', 'Жария оферта') }}</NuxtLink><NuxtLink :to="path('/privacy')">{{ tr('Конфиденциальность', 'Құпиялылық') }}</NuxtLink><NuxtLink :to="`${path('/cabinet')}#documents`">{{ tr('Мои документы', 'Менің құжаттарым') }}</NuxtLink></div></div></section>
    </div>
  </div>
</template>

<style scoped>
.ed-license-document { display: grid; grid-template-columns: 260px minmax(0, 1fr); align-items: start; gap: 48px; padding: 40px 0; border-bottom: 1px solid var(--ed-rule); }
.ed-license-preview { display: block; padding: 8px; background: #fff; border: 1px solid var(--ed-rule); border-radius: var(--ed-radius); }
.ed-license-preview img { width: 100%; height: auto; }
.ed-license-type { font-size: 14px; color: var(--ed-muted); margin-bottom: 14px; }
.ed-license-document h2 { font-size: clamp(28px, 2.6vw, 36px); max-width: 34ch; }
.ed-license-facts { margin: 24px 0; }
.ed-license-facts > div { margin: 16px 0; }
.ed-license-facts dt { font-size: 13px; color: var(--ed-muted); margin-bottom: 4px; }
.ed-license-facts dd { font-size: 16px; line-height: 1.65; max-width: 66ch; overflow-wrap: anywhere; }
.ed-license-note { max-width: 74ch; margin-top: 24px; font-size: 14px; line-height: 1.75; color: var(--ed-muted); }
@media (max-width: 820px) { .ed-license-document { grid-template-columns: 180px minmax(0, 1fr); gap: 28px; } }
@media (max-width: 600px) { .ed-license-document { grid-template-columns: minmax(0, 1fr); gap: 24px; } .ed-license-preview { width: 180px; } }
</style>
