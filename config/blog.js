import occupationalSafety from '../content/blog/ohrana-truda-kazakhstan-2026.js';
import industrialSafety from '../content/blog/promyshlennaya-bezopasnost-kazakhstan-2026.js';
import fireSafety from '../content/blog/pozharnyj-tekhnicheskiy-minimum.js';
import electricalSafety from '../content/blog/elektrobezopasnost-gruppy-dopuska-kazakhstan-2026.js';
import workAtHeight from '../content/blog/raboty-na-vysote-kazakhstan-2026.js';
import biotChanges from '../content/blog/biot-novye-pravila-2026-2027.js';
import ptmExplained from '../content/blog/ptm-rasshifrovka-programmy-2026.js';
import riskRegister from '../content/blog/reestr-professionalnyh-riskov-2026.js';
import gasWork from '../content/blog/gazoopasnye-raboty-dopusk-kazakhstan.js';
import industrialFrequency from '../content/blog/prombezopasnost-itr-periodichnost-obucheniya.js';
import electricalDocuments from '../content/blog/elektrobezopasnost-prisvoenie-gruppy-dokumenty-rk.js';
import documentVerification from '../content/blog/udostoverenie-ohrana-truda-proverka-kazakhstan.js';
import trainingDirections from '../content/blog/ohrana-truda-tehnika-bezopasnosti-raznica.js';
import briefings from '../content/blog/instruktazhi-ohrana-truda-zhurnal-kazakhstan.js';
import trainingPlan from '../content/blog/plan-obucheniya-personala-2027.js';
import safetyInspections from '../content/blog/proverki-ohrany-truda-itogi-2026.js';
import complianceGuarantees from '../content/blog/antikorrupcionnyj-komplaens-trudovye-garantii-2026.js';
import productionControl from '../content/blog/proizvodstvennyj-kontrol-neftegaz-2026.js';
import internalTrainers from '../content/blog/vnutrennie-trenery-ohrana-truda-2026.js';
import digitalSafety from '../content/blog/ii-umnye-kaski-ohrana-truda-2026.js';
import trainingDocuments from '../content/blog/obuchenie-udostoverenie-sertifikat-professiya.js';

import heatingSeason from '../content/blog/otopitelnyj-sezon-bezopasnost-rabochih-mest-2026.js';
import cafeFireSafety from '../content/blog/pozharnaya-bezopasnost-kafe-torgovlya-2026.js';

import almatyHeating from '../content/blog/otopitelnyj-sezon-almaty-2026-2027.js';
import karagandaHeating from '../content/blog/otopitelnyj-sezon-karaganda-2026-2027.js';
import contractRecords from '../content/blog/esutd-trudovye-dogovory-proverka-2026.js';
import constructionControl from '../content/blog/kontrol-ohrany-truda-strojploshchadka-2026.js';
import trainingQuotes from '../content/blog/kp-na-obuchenie-personala-kak-sravnit.js';
import trainingCloseout from '../content/blog/audit-obucheniya-pered-koncom-goda.js';
import qualityStandardTraining from '../content/blog/iso-9001-2026-obuchenie-plan-2027.js';
import environmentalStandardTraining from '../content/blog/iso-14001-2026-podgotovka-personala.js';
import firstAidCourseSelection from '../content/blog/pervaya-pomoshch-vybor-kursa-dlya-kompanii.js';
import shiftTraining from '../content/blog/obuchenie-smennoy-komandy-yazyki-grafik.js';
import { getBlogModifiedAt, getPublishedBlogLocales } from './blog-publication.js';

const registeredPosts = [
  trainingQuotes, trainingCloseout, qualityStandardTraining,
  environmentalStandardTraining, firstAidCourseSelection, shiftTraining,
  almatyHeating, karagandaHeating, contractRecords, constructionControl,
  heatingSeason, cafeFireSafety,
  trainingDocuments,
  safetyInspections, complianceGuarantees, productionControl, internalTrainers, digitalSafety,
  gasWork, industrialFrequency, ptmExplained, electricalDocuments, documentVerification,
  trainingDirections, biotChanges, briefings, riskRegister, trainingPlan,
  occupationalSafety, industrialSafety, fireSafety, electricalSafety, workAtHeight,
];

export const blogPosts = registeredPosts.filter((post) => getPublishedBlogLocales(post).length > 0);

// Content revision dates reflect editorial updates, not deployment timestamps.
export const getSortedBlogPosts = (locale) =>
  blogPosts.filter((post) => !locale || getPublishedBlogLocales(post).includes(locale))
    .sort((a, b) => new Date(getBlogModifiedAt(b, locale)).getTime() - new Date(getBlogModifiedAt(a, locale)).getTime());

export const findBlogPost = (slug) => blogPosts.find((post) => post.slug === slug);

// Explicit month names keep SSR and browsers consistent even with partial ICU data.
export const formatBlogDate = (date, locale = 'ru') => {
  const [year, month, day] = date.split('-').map(Number);
  const months = locale === 'kk'
    ? ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан']
    : ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return `${day} ${months[month - 1]} ${year} ${locale === 'kk' ? 'ж.' : 'г.'}`;
};
