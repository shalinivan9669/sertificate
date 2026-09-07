import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));

const failures = [];
const warnings = [];

const requiredFiles = [
  'docs/compliance/source-register.json',
  'docs/compliance/authority-register.json',
  'docs/compliance/course-registry.seed.json',
  'docs/compliance/document-types.json',
  'docs/compliance/consent-matrix.json',
  'docs/compliance/occupation-registry-map.json',
  'docs/compliance/regulatory-change-log.json',
  'docs/compliance/publication-gates.json',
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(repoRoot, file))) failures.push(`Missing ${file}`);
}

if (failures.length) {
  console.error('[compliance] missing required files');
  failures.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

const sourceRegister = readJson('docs/compliance/source-register.json');
const authorityRegister = readJson('docs/compliance/authority-register.json');
const courseRegistry = readJson('docs/compliance/course-registry.seed.json');
const consentMatrix = readJson('docs/compliance/consent-matrix.json');
const publicationGates = readJson('docs/compliance/publication-gates.json');

const requiredSourceFields = [
  'id',
  'sourceUrl',
  'sourceType',
  'publisher',
  'documentTitle',
  'retrievedAt',
  'status',
  'checksum',
  'copyrightBasis',
  'translationStatus',
  'reviewStatus',
  'notes',
];

const sourceIds = new Set();
for (const source of sourceRegister.sources || []) {
  for (const field of requiredSourceFields) {
    if (!(field in source)) failures.push(`Source ${source.id || '<unknown>'} misses ${field}`);
  }
  if (!source.id) continue;
  if (sourceIds.has(source.id)) failures.push(`Duplicate source id ${source.id}`);
  sourceIds.add(source.id);
  if (!source.checksum) warnings.push(`Source ${source.id} has no canonical content SHA-256 yet`);
}

const authorities = new Map(
  (authorityRegister.authorities || []).map((item) => [item.id, item]),
);
const consentIds = new Set((consentMatrix.consentTypes || []).map((item) => item.id));
const publishedStates = new Set(['published']);

for (const course of courseRegistry.courses || []) {
  const prefix = `Course ${course.slug}`;

  for (const sourceId of course.regulatorySourceIds || []) {
    if (!sourceIds.has(sourceId)) failures.push(`${prefix} references unknown source ${sourceId}`);
  }

  for (const authorityId of course.providerAuthorityIds || []) {
    if (!authorities.has(authorityId)) failures.push(`${prefix} references unknown authority ${authorityId}`);
  }

  for (const consentId of course.requiredConsentTypes || []) {
    if (!consentIds.has(consentId)) failures.push(`${prefix} references unknown consent ${consentId}`);
  }

  if (!publishedStates.has(course.publicationState)) continue;

  const gates = [
    ['provider', (course.providerAuthorityIds || []).length > 0],
    [
      'authority',
      (course.providerAuthorityIds || []).every((id) => {
        const authority = authorities.get(id);
        return authority && authority.status === 'ready_for_publication';
      }),
    ],
    [
      'regulation',
      (course.regulatorySourceIds || []).length > 0 &&
        (course.regulatorySourceIds || []).every((id) => {
          const source = (sourceRegister.sources || []).find((item) => item.id === id);
          return source && source.status === 'effective' && ['reviewed', 'approved'].includes(source.reviewStatus);
        }),
    ],
    ['program', course.program?.status === 'approved'],
    ['document_type', Boolean(course.documentTypeId)],
    ['assessment', course.assessment?.status === 'approved'],
    ['validity', course.validityPolicy?.status === 'verified'],
    ['consents', (course.requiredConsentTypes || []).length > 0],
    ['material_rights', course.materialRightsStatus === 'approved'],
    ['legal_review_date', Boolean(course.lastLegalReviewAt)],
  ];

  for (const [gate, passed] of gates) {
    if (!passed) failures.push(`${prefix} is published but gate "${gate}" is not satisfied`);
  }
}

const coursesSourcePath = path.join(repoRoot, 'config/courses.js');
if (fs.existsSync(coursesSourcePath)) {
  const courseSource = fs.readFileSync(coursesSourcePath, 'utf8').toLowerCase();
  for (const claim of publicationGates.forbiddenUnsubstantiatedClaims || []) {
    if (courseSource.includes(claim.toLowerCase())) {
      failures.push(`Forbidden unsubstantiated phrase found in config/courses.js: "${claim}"`);
    }
  }
}

if (warnings.length) {
  console.warn(`[compliance] ${warnings.length} warning(s)`);
  warnings.forEach((item) => console.warn(`- ${item}`));
}

if (failures.length) {
  console.error(`[compliance] ${failures.length} failure(s)`);
  failures.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log(
  `[compliance] OK: ${(sourceRegister.sources || []).length} sources, ` +
    `${(authorityRegister.authorities || []).length} authorities, ` +
    `${(courseRegistry.courses || []).length} course records. ` +
    'Publication default is deny until all evidence gates pass.',
);
