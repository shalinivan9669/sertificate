import { z } from 'zod';
import { resolveCourseDirection } from './course-registry';
import type { ProgramData } from '../server/services/catalog';

export const PROGRAM_DRAFT_MAX_BYTES = 500_000;
const text = (max: number) => z.string().max(max).refine(value => !value.includes('\0'));
const id = text(150).regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/);
const integer = (min: number, max: number) => z.number().int().min(min).max(max);
const media = z.object({ kind: z.enum(['image', 'video', 'attachment']), url: text(2048), alt: text(2000), transcript: text(100_000) }).strict();
const lesson = z.object({ id, title: text(300), kind: z.enum(['text', 'practice']), required: z.boolean(), body: text(100_000), media: z.array(media).max(20) }).strict();
const question = z.object({ id, text: text(10_000), topic: text(300), options: z.array(z.object({ id, text: text(5000) }).strict()).min(2).max(10), correctOptionIds: z.array(id).min(1).max(10) }).strict();
const draft = z.object({
  title: text(300).min(1), language: z.enum(['ru', 'kk']), audience: text(10_000), prerequisites: text(10_000), outcomes: text(10_000),
  limitations: text(10_000), format: text(10_000), durationHours: integer(1, 5000).nullable(), priceMinor: integer(0, 1_000_000_000).nullable(),
  currency: z.literal('KZT'), accessModel: z.enum(['free', 'manual', 'paid']), billingBasis: z.enum(['learner', 'organization']).optional(),
  documentDescription: text(10_000), support: text(10_000), sourceRefs: z.array(text(2000)).max(50), reviewedAt: text(10),
  modules: z.array(z.object({ id, title: text(300), lessons: z.array(lesson).max(100) }).strict()).max(100),
  assessment: z.object({ durationMinutes: integer(1, 480), maxAttempts: integer(1, 100), passPercent: integer(1, 100), questionCount: integer(1, 300), retakeDelayMinutes: integer(0, 525600) }).strict(),
  questions: z.array(question).max(3000),
}).strict();
const envelope = z.object({ format: z.literal('ot-center-program-draft-v1'), programId: id, data: draft }).strict();

/** Parse only a local authoring file. Saving and approval still use the existing staff API. */
export function parseProgramDraftFile(source: string): { programId: string; data: ProgramData; lessonCount: number; questionCount: number } {
  if (new TextEncoder().encode(source).byteLength > PROGRAM_DRAFT_MAX_BYTES) throw new Error('PROGRAM_DRAFT_TOO_LARGE');
  let parsed: z.infer<typeof envelope>;
  try { parsed = envelope.parse(JSON.parse(source.replace(/^\uFEFF/, ''))); }
  catch { throw new Error('PROGRAM_DRAFT_INVALID'); }
  const direction = resolveCourseDirection(parsed.programId);
  if (!direction) throw new Error('PROGRAM_DRAFT_DIRECTION_UNKNOWN');
  const data = parsed.data;
  const lessons = data.modules.flatMap(module => module.lessons);
  const unique = (values: string[]) => new Set(values).size === values.length;
  if (!unique(data.modules.map(module => module.id)) || !unique(lessons.map(item => item.id)) || !unique(data.questions.map(item => item.id)) ||
      data.questions.some(item => !unique(item.options.map(option => option.id)) || !unique(item.correctOptionIds) || item.correctOptionIds.some(key => !item.options.some(option => option.id === key))) ||
      (data.accessModel === 'free' && data.priceMinor !== 0)) throw new Error('PROGRAM_DRAFT_INVALID');
  // A file cannot import an approval, author identity, version ID, or publication state.
  // Clearing review metadata makes the new draft require a fresh content review.
  return { programId: direction.id, data: { ...data, billingBasis: data.billingBasis ?? 'learner', reviewedAt: '' }, lessonCount: lessons.length, questionCount: data.questions.length };
}
