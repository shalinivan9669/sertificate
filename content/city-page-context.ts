import { cities } from './cities';
import { cityPlanning } from './public-city-content';
import { directionDetails } from './direction-details.js';
import { getPublicCourseValue } from '../shared/public-course-value';
import { courses } from '../config/courses.js';
import { formats } from '../config/formats.js';

// Stable editorial context: no random synonym rotation, office claims or invented dates.
const formatPreparation: Record<string, { ru: string; kk: string }> = {
  online: { ru: 'Проверьте доступ каждого участника к интернету и устройству для занятий. Разделите самостоятельную теорию, встречи с преподавателем и практику: дистанционный доступ не заменяет обязательную практическую подготовку.', kk: 'Әр қатысушының интернетке және оқу құрылғысына қолжетімділігін тексеріңіз. Өздігінен оқылатын теорияны, оқытушымен кездесулерді және практиканы бөліңіз: қашықтан қолжетімділік міндетті практикалық дайындықты алмастырмайды.' },
  ochnoe: { ru: 'Укажите, кто сможет прибыть на занятия и в какие дни. До поездки получите подтверждённые адрес, расписание и требования к практической части; наличие страницы города само по себе не подтверждает местный учебный офис.', kk: 'Сабаққа кім және қай күндері келе алатынын көрсетіңіз. Жолға шықпас бұрын расталған мекенжайды, кестені және практикалық бөлім талаптарын алыңыз; қала парағы жергілікті оқу кеңсесінің бар екенін растамайды.' },
  vyezdnoe: { ru: 'Опишите площадку, доступ преподавателя, помещение и оборудование для практики. Согласуйте инструктаж при входе, пропуска и ответственного за организацию группы; возможность выезда подтверждается для конкретного объекта.', kk: 'Нысанды, оқытушының кіру тәртібін, бөлмені және практика жабдықтарын сипаттаңыз. Кіру нұсқамасын, рұқсатнамаларды және топты ұйымдастыруға жауапты тұлғаны келісіңіз; көшпелі оқыту мүмкіндігі нақты нысан үшін расталады.' },
  srochnoe: { ru: 'Назовите дату, к которой нужна подготовка, и причину ограничения по времени. Сначала сверяются программа, исходные знания и практика, затем ближайший старт: срочность не отменяет обучение и проверку знаний.', kk: 'Дайындық қажет күнді және уақыт шектеуінің себебін көрсетіңіз. Алдымен бағдарлама, бастапқы білім және практика, содан кейін жақын басталу күні келісіледі: жеделдік оқу мен білімді тексеруді жоймайды.' },
  tender: { ru: 'Приложите конкретный пункт технической спецификации, перечень должностей и дату подачи документов. Сопоставьте название программы и итогового документа с требованиями заказчика до заказа обучения.', kk: 'Техникалық ерекшеліктің нақты тармағын, лауазымдар тізімін және құжат тапсыру күнін тіркеңіз. Оқуға тапсырыс бермес бұрын бағдарлама мен қорытынды құжат атауын тапсырыс беруші талаптарымен салыстырыңыз.' },
  prodlenie: { ru: 'Подготовьте прежний документ, дату предыдущей проверки знаний и сведения об изменении должности или вида работ. Уточните необходимость повторной подготовки и новой проверки: прежний документ не продлевается автоматически.', kk: 'Бұрынғы құжатты, алдыңғы білім тексеру күнін және лауазым не жұмыс түрінің өзгеруі туралы мәліметтерді дайындаңыз. Қайта даярлау мен жаңа тексеру қажеттілігін нақтылаңыз: бұрынғы құжат автоматты түрде ұзартылмайды.' },
};

export function buildCityPageContext(citySlug: string | undefined, kind: 'course' | 'format', topicId: string, locale = 'ru') {
  const city = cities.find(item => item.slug === citySlug);
  const lang = locale === 'kk' ? 'kk' : 'ru';
  const topic = kind === 'course' ? courses.find(item => item.slug === topicId) : formats.find(item => item.type === topicId);
  if (!city || !topic || !cityPlanning[city.slug]) return null;
  const name = city.name[lang];
  const planning = cityPlanning[city.slug]![lang];
  const title = 'name' in topic ? topic.name[lang] : topic.seo.title[lang].split('{{cityPrepositional}}')[0]!.trim();
  const details = kind === 'course' && Object.hasOwn(directionDetails, topicId) ? directionDetails[topicId as keyof typeof directionDetails][lang] : undefined;
  const value = kind === 'course' ? getPublicCourseValue(topicId) : undefined;
  const preparation = kind === 'format' ? formatPreparation[topicId]?.[lang] : details?.clarify || value?.description[lang];
  if (!preparation) return null;
  const sections = [
    { id: 'local-planning', title: lang === 'kk' ? `${name}: оқу тобын жоспарлау` : `${name}: как организовать группу`, text: planning },
    { id: 'local-preparation', title: lang === 'kk' ? `${title}: өтінімге қажетті мәліметтер` : `${title}: что подготовить для заявки`, text: preparation, bullets: details?.topics || [] },
    { id: 'local-agreement', title: lang === 'kk' ? 'Оқу басталғанға дейін келісілетін шарттар' : 'Что согласовать до начала обучения', text: lang === 'kk'
      ? `${name} қаласындағы топ үшін қатысушыларды қызметтік міндеттері бойынша бөліңіз. Әр топқа бағдарлама, оқу тілі, практика, білімді тексеру және құжат алу тәсілі келісіледі.`
      : `Для группы из города ${name} разделите участников по рабочим обязанностям. Для каждой группы согласуйте программу, язык занятий, практику, проверку знаний и способ получения документов.` },
  ];
  const faqs = [
    { q: lang === 'kk' ? `${name}: «${title}» оқуына топты қалай дайындауға болады?` : `Как подготовить группу из города ${name} по направлению «${title}»?`, a: `${planning} ${preparation}` },
    { q: lang === 'kk' ? 'Жазылу алдында қандай шарттар расталады?' : 'Какие условия подтверждаются перед записью?', a: lang === 'kk' ? `${title}: бағдарлама, практика, мерзім, баға және қорытынды құжат жеке келісіледі. ${planning}` : `${title}: программа, практика, сроки, стоимость и итоговый документ согласуются индивидуально. ${planning}` },
  ];
  const links = kind === 'course'
    ? formats.map(item => ({ label: item.seo.title[lang].split('{{cityPrepositional}}')[0]!.trim(), to: `/${city.slug}/${item.slug}` }))
    : courses.map(item => ({ label: item.name[lang], to: `/${city.slug}/${item.slug}` }));
  return { sections, faqs, links, description: `${title} — ${name}. ${preparation}` };
}
