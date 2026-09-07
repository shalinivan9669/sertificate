import { randomUUID } from 'node:crypto';
import { audit, databaseConfigured, execute, queryAll, queryOne, withTransaction, type Db } from '../db';
import { courseDirections, legacyCourseDirections, resolveCourseDirection } from '../../shared/course-registry';
import { getSourceProductForDirection, sourceProductDocument } from '../../shared/source-products';
import { entityId, fail, integer, record, strictKeys, textValue } from '../utils/validation';
import { assertRole, type AppUser } from '../utils/auth';

export type Lesson = {
  id: string; title: string; kind: 'text' | 'practice'; required: boolean; body: string;
  media: { kind: 'image' | 'video' | 'attachment'; url: string; alt: string; transcript: string }[];
};
export type Question = { id: string; text: string; topic: string; options: { id: string; text: string }[]; correctOptionIds: string[] };
export type ProgramData = {
  title: string; language: 'ru' | 'kk'; audience: string; prerequisites: string; outcomes: string;
  limitations: string; format: string; durationHours: number; priceMinor: number | null; currency: 'KZT'; billingBasis?: 'learner' | 'organization';
  accessModel: 'free' | 'manual' | 'paid'; documentDescription: string; support: string;
  sourceRefs: string[]; reviewedAt: string;
  modules: { id: string; title: string; lessons: Lesson[] }[];
  assessment: { durationMinutes: number; maxAttempts: number; passPercent: number; questionCount: number; retakeDelayMinutes: number };
  questions: Question[];
};
export type VersionRow = {
  id: string; program_id: string; version: number; status: 'draft' | 'review' | 'published'; data_json: string;
  created_by: string; approved_by: string | null; published_at: string | null; revision: number;
  intake_open?: number | null;
};

function boundedArray(value: unknown, label: string, max: number): any[] {
  if (!Array.isArray(value) || value.length > max) fail(400, 'INVALID_CONTENT', `Invalid ${label}`);
  return value;
}
function unique(values: string[], label: string) { if (new Set(values).size !== values.length) fail(400, 'DUPLICATE_ID', `Duplicate ${label}`); }

/** Content is plain text. HTML is neither trusted nor rendered by the learner UI. */
export function validateProgramData(value: unknown, publishing = false): ProgramData {
  const input = record(value, 'data');
  strictKeys(input, ['title', 'language', 'audience', 'prerequisites', 'outcomes', 'limitations', 'format', 'durationHours', 'priceMinor', 'currency', 'billingBasis', 'accessModel', 'documentDescription', 'support', 'sourceRefs', 'reviewedAt', 'modules', 'assessment', 'questions']);
  const title = textValue(input.title, 'title', 300);
  if (!['ru', 'kk'].includes(input.language) || input.currency !== 'KZT' || !['free', 'manual', 'paid'].includes(input.accessModel)) fail(400, 'INVALID_CONTENT', 'Invalid language, currency or access model');
  const data: any = { title, language: input.language, currency: 'KZT', accessModel: input.accessModel };
  if (input.billingBasis !== undefined && !['learner', 'organization'].includes(input.billingBasis)) fail(400, 'INVALID_CONTENT', 'Invalid billing basis');
  data.billingBasis = input.billingBasis ?? 'learner';
  for (const field of ['audience', 'prerequisites', 'outcomes', 'limitations', 'format', 'documentDescription', 'support']) data[field] = textValue(input[field] ?? '', field, 10_000, publishing && !['prerequisites', 'limitations'].includes(field));
  data.durationHours = integer(input.durationHours, 'durationHours', 1, 5000);
  data.priceMinor = input.priceMinor === null ? null : integer(input.priceMinor, 'priceMinor', 0, 1_000_000_000);
  if (data.accessModel === 'free' && data.priceMinor !== 0) fail(400, 'INVALID_CONTENT', 'Free programs must explicitly have zero price');
  if (publishing && data.accessModel === 'paid' && (!data.priceMinor || data.priceMinor < 1)) fail(422, 'PUBLICATION_INCOMPLETE', 'Paid programs require an approved positive price');
  data.reviewedAt = textValue(input.reviewedAt ?? '', 'reviewedAt', 10, publishing);
  if (data.reviewedAt && (!/^\d{4}-\d{2}-\d{2}$/.test(data.reviewedAt) || !Number.isFinite(Date.parse(data.reviewedAt)) || data.reviewedAt > new Date().toISOString().slice(0, 10))) fail(400, 'INVALID_CONTENT', 'Invalid review date');
  data.sourceRefs = boundedArray(input.sourceRefs ?? [], 'sourceRefs', 50).map((source) => textValue(source, 'source reference', 2000));
  data.modules = boundedArray(input.modules, 'modules', 100).map((rawModule) => {
    const module = record(rawModule, 'module'); strictKeys(module, ['id', 'title', 'lessons']);
    return { id: entityId(module.id), title: textValue(module.title, 'module title', 300), lessons: boundedArray(module.lessons, 'lessons', 100).map((rawLesson) => {
      const lesson = record(rawLesson, 'lesson'); strictKeys(lesson, ['id', 'title', 'kind', 'required', 'body', 'media']);
      if (!['text', 'practice'].includes(lesson.kind) || typeof lesson.required !== 'boolean') fail(400, 'INVALID_CONTENT', 'Invalid lesson kind or required flag');
      const media = boundedArray(lesson.media ?? [], 'media', 20).map((rawMedia) => {
        const media = record(rawMedia, 'media'); strictKeys(media, ['kind', 'url', 'alt', 'transcript']);
        if (!['image', 'video', 'attachment'].includes(media.kind)) fail(400, 'INVALID_CONTENT', 'Invalid media type');
        const url = textValue(media.url, 'media URL', 2048);
        const allowedHosts = (process.env.OT_CONTENT_HOSTS || '').split(',').filter(Boolean);
        let parsed: URL; try { parsed = new URL(url); } catch { fail(400, 'INVALID_CONTENT', 'Media must use an approved HTTPS host'); }
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !allowedHosts.includes(parsed.hostname) || /\.(?:html?|svg|js)(?:[?#]|$)/i.test(url)) fail(400, 'INVALID_CONTENT', 'Media must use an approved HTTPS host and safe file type');
        return { kind: media.kind, url, alt: textValue(media.alt ?? '', 'media alt', 2000, publishing && media.kind === 'image'), transcript: textValue(media.transcript ?? '', 'video transcript', 100_000, publishing && media.kind === 'video') };
      });
      return { id: entityId(lesson.id), title: textValue(lesson.title, 'lesson title', 300), kind: lesson.kind, required: lesson.required, body: textValue(lesson.body ?? '', 'lesson body', 100_000, publishing), media };
    }) };
  });
  const lessons = data.modules.flatMap((module: any) => module.lessons);
  unique(data.modules.map((module: any) => module.id), 'module IDs'); unique(lessons.map((lesson: Lesson) => lesson.id), 'lesson IDs');
  const policy = record(input.assessment, 'assessment'); strictKeys(policy, ['durationMinutes', 'maxAttempts', 'passPercent', 'questionCount', 'retakeDelayMinutes']);
  data.assessment = {
    durationMinutes: integer(policy.durationMinutes, 'durationMinutes', 1, 480), maxAttempts: integer(policy.maxAttempts, 'maxAttempts', 1, 100),
    passPercent: integer(policy.passPercent, 'passPercent', 1, 100), questionCount: integer(policy.questionCount, 'questionCount', 1, 300),
    retakeDelayMinutes: integer(policy.retakeDelayMinutes, 'retakeDelayMinutes', 0, 525600),
  };
  data.questions = boundedArray(input.questions, 'questions', 3000).map((rawQuestion) => {
    const question = record(rawQuestion, 'question'); strictKeys(question, ['id', 'text', 'topic', 'options', 'correctOptionIds']);
    const options = boundedArray(question.options, 'options', 10).map((rawOption) => {
      const option = record(rawOption, 'option'); strictKeys(option, ['id', 'text']);
      return { id: entityId(option.id), text: textValue(option.text, 'option text', 5000) };
    });
    if (options.length < 2) fail(400, 'INVALID_CONTENT', 'Questions require at least two options');
    unique(options.map((option) => option.id), 'option IDs');
    const correctOptionIds = boundedArray(question.correctOptionIds, 'correctOptionIds', 10).map((id) => entityId(id));
    unique(correctOptionIds, 'correct options');
    if (!correctOptionIds.length || correctOptionIds.some((id) => !options.some((option) => option.id === id))) fail(400, 'INVALID_CONTENT', 'Correct options must belong to the question');
    return { id: entityId(question.id), text: textValue(question.text, 'question text', 10000), topic: textValue(question.topic, 'question topic', 300), options, correctOptionIds };
  });
  unique(data.questions.map((question: Question) => question.id), 'question IDs');
  if (publishing && (!data.sourceRefs.length || !lessons.length || !lessons.some((lesson: Lesson) => lesson.required) || data.questions.length < data.assessment.questionCount || data.modules.some((module: any) => !module.lessons.length))) fail(422, 'PUBLICATION_INCOMPLETE', 'Approved sources, required lessons and a sufficient question bank are required');
  if (JSON.stringify(data).length > 500_000) fail(413, 'CONTENT_TOO_LARGE', 'Program data exceeds 500 KB');
  return data as ProgramData;
}

export function publicVersion(row: VersionRow) {
  const data: ProgramData = JSON.parse(row.data_json);
  return {
    id: row.id, programId: row.program_id, version: row.version, title: data.title, language: data.language, intakeOpen: row.intake_open !== 0,
    audience: data.audience, prerequisites: data.prerequisites, outcomes: data.outcomes, limitations: data.limitations,
    format: data.format, durationHours: data.durationHours, priceMinor: data.priceMinor, currency: data.currency, billingBasis: data.billingBasis ?? 'learner',
    accessModel: data.accessModel, documentDescription: data.documentDescription, support: data.support,
    reviewedAt: data.reviewedAt, publishedAt: row.published_at,
    modules: data.modules.map((module) => ({ id: module.id, title: module.title, lessons: module.lessons.map(({ id, title, required, kind }) => ({ id, title, required, kind })) })),
  };
}

function inventoryMetadata(directionId: string) {
  const source = getSourceProductForDirection(directionId);
  const basis = source?.pricingBasis || null;
  return {
    pricing: { mode: 'request' as const, amountMinor: null, currency: 'KZT' as const, basis,
      label: { ru: 'Стоимость по запросу', kk: 'Бағасы сұрау бойынша' },
      basisLabel: basis === 'organization' ? { ru: 'Расчёт для организации', kk: 'Ұйым үшін есептеу' } : basis === 'learner' ? { ru: 'Расчёт на одного обучаемого', kk: 'Бір тыңдаушы үшін есептеу' } : { ru: 'Уточним условия обучения', kk: 'Оқу шарттарын нақтылаймыз' } },
    sourceProduct: source ? { id: source.id, title: source.title, sourceDocumentId: source.sourceDocumentId, sourcePage: source.sourcePage, sourceRow: source.sourceRow, academicContentStatus: source.academicContentStatus, guidance: source.guidance } : null,
  };
}

function publicDirectionPath(id: string) { return legacyCourseDirections.some(direction => direction.id === id) ? `/${id}` : `/courses/${id}`; }

export async function catalogPrograms() {
  const storageAvailable = databaseConfigured();
  const programs = storageAvailable ? await queryAll('SELECT * FROM programs ORDER BY created_at,id') : courseDirections.map((direction) => ({ id: direction.id, direction_id: direction.id, title_json: JSON.stringify(direction.title), status: 'active' }));
  const versions = storageAvailable ? await queryAll<VersionRow>("SELECT v.*,c.is_open AS intake_open FROM program_versions v JOIN programs p ON p.id=v.program_id LEFT JOIN program_intake_controls c ON c.version_id=v.id WHERE v.status='published' AND p.status='active' ORDER BY v.version DESC") : [];
  return { storageAvailable, programs: programs.map((program) => {
    const direction = resolveCourseDirection(program.direction_id)!;
    const published = versions.filter((version) => version.program_id === program.id);
    return { id: program.id, directionId: program.direction_id, slug: direction.id, title: JSON.parse(program.title_json), publicPath: publicDirectionPath(direction.id), ...inventoryMetadata(direction.id), versions: published.map(publicVersion), availability: published.length ? 'published' : 'consultation' };
  }) };
}

export async function catalogProgram(id: string) {
  const direction = resolveCourseDirection(id);
  if (!databaseConfigured()) {
    if (!direction) fail(404, 'PROGRAM_NOT_FOUND', 'Program not found');
    return { program: { id: direction.id, directionId: direction.id, slug: direction.id, title: direction.title, publicPath: publicDirectionPath(direction.id), ...inventoryMetadata(direction.id), versions: [], availability: 'consultation' } };
  }
  const program = await queryOne('SELECT id,direction_id,title_json,status FROM programs WHERE id=?', [direction?.id || id]);
  if (!program) fail(404, 'PROGRAM_NOT_FOUND', 'Program not found');
  const metadata = resolveCourseDirection(program.direction_id)!;
  const versions = program.status === 'active' ? await queryAll<VersionRow>("SELECT v.*,c.is_open AS intake_open FROM program_versions v LEFT JOIN program_intake_controls c ON c.version_id=v.id WHERE v.program_id=? AND v.status='published' ORDER BY v.version DESC", [program.id]) : [];
  return { program: { id: program.id, directionId: program.direction_id, slug: metadata.id, title: JSON.parse(program.title_json), publicPath: publicDirectionPath(metadata.id), ...inventoryMetadata(metadata.id), versions: versions.map(publicVersion), availability: versions.length ? 'published' : 'consultation' } };
}

/** An authoring checklist from actual inventory metadata; this does not create or approve a draft. */
export async function getAuthoringGuide(actor: AppUser, id: string) {
  assertRole(actor, ['editor', 'reviewer']);
  const direction = resolveCourseDirection(id);
  const program = await queryOne('SELECT id,direction_id,title_json FROM programs WHERE id=?', [direction?.id || id]);
  if (!program) fail(404, 'PROGRAM_NOT_FOUND', 'Program not found');
  const source = getSourceProductForDirection(program.direction_id);
  const title = JSON.parse(program.title_json) as { ru: string; kk: string };
  const fields = [
    { path: 'title', provided: true, value: title, label: { ru: 'Название направления', kk: 'Бағыт атауы' } },
    { path: 'billingBasis', provided: Boolean(source), value: source?.pricingBasis ?? null, label: { ru: 'Единица расчёта: слушатель или организация', kk: 'Есептеу бірлігі: тыңдаушы немесе ұйым' } },
    { path: 'audience', provided: false, label: { ru: 'Целевая аудитория и должности', kk: 'Мақсатты аудитория және лауазымдар' } },
    { path: 'prerequisites', provided: false, label: { ru: 'Требования к слушателю', kk: 'Тыңдаушыға қойылатын талаптар' } },
    { path: 'outcomes', provided: false, label: { ru: 'Проверяемые результаты обучения', kk: 'Тексерілетін оқу нәтижелері' } },
    { path: 'format', provided: false, label: { ru: 'Формат и организация обучения', kk: 'Оқу форматы және оны ұйымдастыру' } },
    { path: 'durationHours', provided: false, label: { ru: 'Утверждённая длительность', kk: 'Бекітілген ұзақтығы' } },
    { path: 'modules', provided: false, label: { ru: 'Модули, уроки и реальные материалы', kk: 'Модульдер, сабақтар және нақты материалдар' } },
    { path: 'practice', provided: false, label: { ru: 'Практика и подтверждение инструктором, если необходимы', kk: 'Қажет болса, практика және нұсқаушының растауы' } },
    { path: 'assessment', provided: false, label: { ru: 'Правила экзамена и повторных попыток', kk: 'Емтихан және қайта тапсыру ережелері' } },
    { path: 'questions', provided: false, label: { ru: 'Банк вопросов с ответами и проверкой эксперта', kk: 'Жауаптары бар және сарапшы тексерген сұрақтар банкі' } },
    { path: 'sourceRefs', provided: false, label: { ru: 'Источники учебных материалов', kk: 'Оқу материалдарының дереккөздері' } },
    { path: 'support', provided: false, label: { ru: 'Контакты и порядок поддержки', kk: 'Байланыс деректері және қолдау тәртібі' } },
    { path: 'documentDescription', provided: false, label: { ru: 'Документ и условия его выдачи', kk: 'Құжат және оны беру шарттары' } },
    { path: 'accessModel', provided: false, label: { ru: 'Условия предоставления доступа', kk: 'Қолжетімділік беру шарттары' } },
    { path: 'reviewedAt', provided: false, label: { ru: 'Дата проверки содержания', kk: 'Мазмұнды тексеру күні' } },
  ];
  return { guide: { programId: program.id, directionId: program.direction_id, title, ...inventoryMetadata(program.direction_id),
    source: source ? { documentId: source.sourceDocumentId, documentTitle: sourceProductDocument.title, sourcePage: source.sourcePage, sourceRow: source.sourceRow, sourceNameRaw: source.sourceNameRaw, sourceDescriptionRaw: source.sourceDescriptionRaw, sourceNoteRaw: source.sourceNoteRaw, standardAsWritten: source.standardAsWritten, clarifications: source.clarifications } : null,
    fields, missingFields: fields.filter(field => !field.provided).map(field => field.path),
    readiness: { canPublish: false, reason: source ? 'SOURCE_IS_SERVICE_INVENTORY' : 'ACADEMIC_CONTENT_NOT_PROVIDED' },
    workflow: ['author_supplies_content', 'validate_required_materials_and_assessment', 'independent_reviewer_approves', 'publish_immutable_version'] } };
}

export async function getVersion(id: string, db?: Db): Promise<VersionRow> {
  const row = await queryOne<VersionRow>('SELECT * FROM program_versions WHERE id=?', [id], db);
  if (!row) fail(404, 'VERSION_NOT_FOUND', 'Program version not found');
  return row;
}

function adminVersion(row: VersionRow) { return { id: row.id, programId: row.program_id, version: row.version, status: row.status, revision: row.revision, createdBy: row.created_by, approvedBy: row.approved_by, publishedAt: row.published_at, data: JSON.parse(row.data_json) }; }

export async function listVersions(actor: AppUser) {
  assertRole(actor, ['editor', 'reviewer']);
  return { versions: (await queryAll<VersionRow>('SELECT * FROM program_versions ORDER BY created_at DESC LIMIT 200')).map(adminVersion) };
}

export async function createVersion(actor: AppUser, programId: string, value: unknown) {
  assertRole(actor, ['editor']);
  const data = validateProgramData(value);
  return withTransaction(async (tx) => {
    if (!await queryOne('SELECT id FROM programs WHERE id=?', [programId], tx)) fail(404, 'PROGRAM_NOT_FOUND', 'Program not found');
    const version = Number((await queryOne('SELECT COALESCE(MAX(version),0)+1 AS next FROM program_versions WHERE program_id=?', [programId], tx))!.next);
    const id = randomUUID(); const now = new Date().toISOString();
    await execute('INSERT INTO program_versions (id,program_id,version,data_json,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?)', [id, programId, version, JSON.stringify(data), actor.id, now, now], tx);
    await audit(actor.id, 'program.draft_created', id, '', null, tx);
    return { version: adminVersion(await getVersion(id, tx)) };
  });
}

export async function updateVersion(actor: AppUser, id: string, revision: number, value: unknown) {
  assertRole(actor, ['editor']); const data = validateProgramData(value);
  return withTransaction(async (tx) => {
    const row = await getVersion(id, tx);
    if (row.status === 'published') fail(409, 'VERSION_IMMUTABLE', 'Create a new version to edit published material');
    if (row.revision !== revision) fail(409, 'REVISION_CONFLICT', 'A newer content revision exists');
    // The latest editor becomes the author: editing cannot be used to bypass reviewer separation.
    await execute("UPDATE program_versions SET data_json=?,status='draft',created_by=?,approved_by=NULL,review_evidence=NULL,revision=revision+1,updated_at=? WHERE id=?", [JSON.stringify(data), actor.id, new Date().toISOString(), id], tx);
    await audit(actor.id, 'program.draft_updated', id, '', null, tx);
    return { version: adminVersion(await getVersion(id, tx)) };
  });
}

export async function reviewVersion(actor: AppUser, id: string, revision: number) {
  assertRole(actor, ['editor']);
  return withTransaction(async (tx) => {
    const row = await getVersion(id, tx);
    if (row.status !== 'draft' || row.revision !== revision) fail(409, 'REVISION_CONFLICT', 'Only the current draft can enter review');
    validateProgramData(JSON.parse(row.data_json), true);
    await execute("UPDATE program_versions SET status='review',revision=revision+1,updated_at=? WHERE id=?", [new Date().toISOString(), id], tx);
    await audit(actor.id, 'program.review_requested', id, '', null, tx);
    return { version: adminVersion(await getVersion(id, tx)) };
  });
}

export async function publishVersion(actor: AppUser, id: string, revision: number, evidence: string) {
  assertRole(actor, ['reviewer']); textValue(evidence, 'review evidence', 4000);
  return withTransaction(async (tx) => {
    const row = await getVersion(id, tx);
    if (row.created_by === actor.id) fail(403, 'SEPARATE_REVIEWER_REQUIRED', 'The author cannot approve their own program');
    if (row.status !== 'review' || row.revision !== revision) fail(409, 'REVISION_CONFLICT', 'Only the reviewed revision can be published');
    validateProgramData(JSON.parse(row.data_json), true);
    const now = new Date().toISOString();
    await execute("UPDATE program_versions SET status='published',approved_by=?,review_evidence=?,published_at=?,updated_at=?,revision=revision+1 WHERE id=?", [actor.id, evidence, now, now, id], tx);
    await audit(actor.id, 'program.published', id, evidence, null, tx);
    return { version: adminVersion(await getVersion(id, tx)) };
  });
}

export async function createProgram(actor: AppUser, input: Record<string, any>) {
  assertRole(actor, ['editor']);
  const direction = resolveCourseDirection(input.directionId); if (!direction) fail(400, 'INVALID_DIRECTION', 'Unknown direction');
  const id = entityId(input.id); const title = record(input.title);
  if (resolveCourseDirection(id)?.alias === id) fail(409, 'PROGRAM_ID_RESERVED', 'Historical route aliases are reserved for their original direction');
  strictKeys(title, ['ru', 'kk']); const names = { ru: textValue(title.ru, 'RU title', 300), kk: textValue(title.kk, 'KK title', 300) };
  return withTransaction(async (tx) => {
    if (await queryOne('SELECT id FROM programs WHERE id=?', [id], tx)) fail(409, 'PROGRAM_EXISTS', 'Program identifier already exists');
    await execute('INSERT INTO programs (id,direction_id,title_json,created_at) VALUES (?,?,?,?)', [id, direction.id, JSON.stringify(names), new Date().toISOString()], tx);
    await audit(actor.id, 'program.created', id, '', null, tx);
    return { id };
  });
}
