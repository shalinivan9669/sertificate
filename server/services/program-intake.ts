import { z } from 'zod';
import { audit, execute, queryOne, withTransaction, type Db } from '../db';
import { assertRole, type AppUser } from '../utils/auth';
import { businessFail as fail, nowIso, parse } from '../utils/business';

const input = z.object({ open: z.boolean(), reason: z.string().trim().min(10).max(2000) }).strict();

/** Only creation boundaries call this guard; existing learning and evidence remain valid. */
export async function assertProgramIntakeOpen(versionId: string, tx: Db) {
  const control = await queryOne<{ is_open: number }>('SELECT is_open FROM program_intake_controls WHERE version_id=?', [versionId], tx);
  if (control?.is_open === 0) fail(409, 'PROGRAM_INTAKE_CLOSED');
}

export async function setProgramIntake(actor: AppUser, versionId: string, value: unknown) {
  assertRole(actor, ['admin']);
  const body = parse(input, value);
  return withTransaction(async tx => {
    const currentActor = await queryOne<{ role: string; twoFactorEnabled: number }>('SELECT role,twoFactorEnabled FROM "user" WHERE id=?', [actor.id], tx);
    if (!currentActor || currentActor.role !== 'admin' || !currentActor.twoFactorEnabled) fail(403, 'FORBIDDEN');
    const version = await queryOne<{ status: string }>('SELECT status FROM program_versions WHERE id=?', [versionId], tx);
    if (!version) fail(404, 'VERSION_NOT_FOUND');
    if (version.status !== 'published') fail(409, 'PUBLISHED_VERSION_REQUIRED');
    const previous = await queryOne<{ is_open: number }>('SELECT is_open FROM program_intake_controls WHERE version_id=?', [versionId], tx);
    const previousOpen = previous?.is_open !== 0;
    if (previousOpen === body.open) return { versionId, intakeOpen: body.open, duplicate: true };
    const timestamp = nowIso();
    await execute('INSERT INTO program_intake_controls(version_id,is_open,actor_id,reason,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(version_id) DO UPDATE SET is_open=excluded.is_open,actor_id=excluded.actor_id,reason=excluded.reason,updated_at=excluded.updated_at', [versionId, Number(body.open), actor.id, body.reason, timestamp], tx);
    await audit(actor.id, body.open ? 'program.intake_opened' : 'program.intake_closed', versionId, body.reason, null, tx);
    return { versionId, intakeOpen: body.open, duplicate: false, updatedAt: timestamp };
  });
}
