/** Prepare only a local synthetic terminal-attempt view. Run after the staff browser suite. */
import { request } from '@playwright/test';
import { access, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const check = (condition, code) => { if (!condition) throw Object.assign(new Error(code), { safeCode: code }); };
const samePath = (left, right) => process.platform === 'win32' ? resolve(left).toLowerCase() === resolve(right).toLowerCase() : resolve(left) === resolve(right);
const repo = fileURLToPath(new URL('../', import.meta.url));
let api;
try {
  check(process.env.NODE_ENV === 'test' && process.env.OT_ALLOW_TEST_SEED === '1', 'EXPLICIT_LOCAL_TEST_ENV_REQUIRED');
  check(!process.env.VERCEL && !process.env.VERCEL_ENV && !process.env.TURSO_DATABASE_URL && !process.env.TURSO_AUTH_TOKEN, 'REMOTE_OR_VERCEL_FORBIDDEN');
  const base = process.env.PERF_CURRENT_BASE || process.env.TEST_BASE_URL || 'http://127.0.0.1:3101';
  check(/^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(base), 'LOCAL_HTTP_BASE_REQUIRED');
  const databasePath = process.env.OT_DATABASE_PATH;
  check(databasePath && basename(databasePath) === 'e2e.sqlite' && samePath(databasePath, resolve(repo, '.data/e2e.sqlite')), 'EXPLICIT_LOCAL_E2E_DATABASE_REQUIRED');
  await access(databasePath);
  const fixture = JSON.parse(await readFile(resolve(repo, '.data/e2e-fixture.json'), 'utf8'));
  check(fixture.notice === 'SYNTHETIC LOCAL TEST DATA ONLY' && samePath(fixture.databasePath || '.', databasePath), 'MATCHING_SYNTHETIC_FIXTURE_REQUIRED');
  check(fixture.learner?.id === 'e2e-learner' && fixture.learner?.email === 'browser-learner@example.test' && typeof fixture.learner?.password === 'string' && fixture.learner.password.length >= 12, 'EXPECTED_SYNTHETIC_LEARNER_REQUIRED');
  check(typeof fixture.versionId === 'string' && /^[A-Za-z0-9_-]+$/.test(fixture.versionId), 'FIXTURE_VERSION_REQUIRED');
  const { createClient } = await import('@libsql/client');
  const db = createClient({ url: `file:${resolve(databasePath).replaceAll('\\', '/')}`, concurrency: 1 });
  let attempt;
  try {
    // Direct client, never getDb/migrate or write a session through SQL.
    await db.execute('PRAGMA query_only=ON');
    const user = (await db.execute({ sql: 'SELECT id,email,emailVerified,twoFactorEnabled,role FROM "user" WHERE id=?', args: [fixture.learner.id] })).rows[0];
    check(user?.email === fixture.learner.email && Number(user.emailVerified) === 1 && user.role === 'learner' && Number(user.twoFactorEnabled) === 0, 'VERIFIED_SYNTHETIC_LEARNER_REQUIRED');
    const version = (await db.execute({ sql: 'SELECT data_json,created_by FROM program_versions WHERE id=? AND status=?', args: [fixture.versionId, 'published'] })).rows[0];
    const content = version ? JSON.parse(String(version.data_json)) : null;
    check(version?.created_by === fixture.editor?.id && content?.sourceRefs?.includes('tests/e2e-fixtures.ts synthetic content'), 'ORIGINAL_SYNTHETIC_VERSION_REQUIRED');
    attempt = (await db.execute({ sql: `SELECT a.id,a.enrollment_id,a.status FROM attempts a JOIN enrollments e ON e.id=a.enrollment_id
      WHERE e.user_id=? AND e.version_id=? AND a.status IN ('graded','expired') AND a.result_json IS NOT NULL
      ORDER BY a.submitted_at DESC,a.created_at DESC LIMIT 1`, args: [fixture.learner.id, fixture.versionId] })).rows[0];
    check(attempt && /^[A-Za-z0-9_-]+$/.test(String(attempt.id)) && /^[A-Za-z0-9_-]+$/.test(String(attempt.enrollment_id)), 'EXISTING_TERMINAL_ATTEMPT_REQUIRED');
  } finally { db.close(); }
  const examPath = `/learn/${attempt.enrollment_id}/exam?attempt=${attempt.id}`;
  api = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base }, timeout: 15000, maxRedirects: 0 });
  const signIn = await api.post('/api/auth/sign-in/email', { data: { email: fixture.learner.email, password: fixture.learner.password, rememberMe: false }, maxRedirects: 0 });
  check(signIn.status() === 200, 'HTTP_SIGN_IN_FAILED');
  const signedIn = await signIn.json();
  check(!signedIn.twoFactorRedirect && signedIn.user?.id === fixture.learner.id && signedIn.user?.emailVerified === true, 'HTTP_VERIFIED_LEARNER_SIGN_IN_REQUIRED');
  const sessionResponse = await api.get('/api/auth/get-session', { maxRedirects: 0 });
  check(sessionResponse.status() === 200, 'HTTP_SESSION_CHECK_FAILED');
  const session = await sessionResponse.json();
  check(session.user?.id === fixture.learner.id && session.user?.emailVerified === true, 'VERIFIED_HTTP_SESSION_REQUIRED');
  const terminalResponse = await api.get(`/api/v1/attempts/${attempt.id}`, { maxRedirects: 0 });
  check(terminalResponse.status() === 200, 'HTTP_TERMINAL_ATTEMPT_CHECK_FAILED');
  const terminal = await terminalResponse.json();
  check(terminal.id === attempt.id && terminal.enrollmentId === attempt.enrollment_id && ['graded', 'expired'].includes(terminal.status) && terminal.result && typeof terminal.result.pass === 'boolean', 'HTTP_TERMINAL_RESULT_REQUIRED');
  const state = await api.storageState();
  check(Array.isArray(state.cookies) && state.cookies.some(cookie => cookie.httpOnly && cookie.name.includes('session_token')), 'AUTH_COOKIE_REQUIRED');
  const cookieHost = new URL(base).hostname;
  check(state.cookies.every(cookie => cookie.domain.replace(/^\./, '') === cookieHost), 'LOCAL_COOKIE_SCOPE_REQUIRED');
  // Exact Playwright storageState format consumed by scripts/performance-lab.mjs.
  await writeFile(resolve(repo, '.data/e2e-performance-session.json'), JSON.stringify(state), { mode: 0o600 });
  await writeFile(resolve(repo, '.data/e2e-performance-url.txt'), `${examPath}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ status: 'prepared', scope: 'local synthetic terminal attempt', academicWrites: 0, signIn: 'verified HTTP', secretOutput: false }));
} catch (error) {
  // Never print Playwright request diagnostics, credentials, cookies, tokens, or fixture contents.
  console.error(JSON.stringify({ status: 'failed', code: error?.safeCode || 'PERFORMANCE_SESSION_PREPARATION_FAILED' }));
  process.exitCode = 1;
} finally { await api?.dispose().catch(() => {}); }
