/** Reset ONLY synthetic browser-test learning records. No application imports this helper. */
import { basename, resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { closeDb, execute, queryOne, withTransaction } from "../server/db";
const fixture = JSON.parse(
  await readFile(resolve(".data/e2e-fixture.json"), "utf8"),
);
if (
  process.env.NODE_ENV !== "test" ||
  process.env.OT_ALLOW_TEST_SEED !== "1" ||
  process.env.VERCEL ||
  process.env.TURSO_DATABASE_URL ||
  basename(process.env.OT_DATABASE_PATH || "") !== "e2e.sqlite" ||
  resolve(process.env.OT_DATABASE_PATH!) !== resolve(fixture.databasePath) ||
  fixture.notice !== "SYNTHETIC LOCAL TEST DATA ONLY"
)
  throw new Error(
    "Only explicitly isolated local browser test data may be reset",
  );
try {
  await withTransaction(async (tx) => {
    for (const userId of ["e2e-learner", "e2e-other"]) {
      const user = await queryOne(
        'SELECT email FROM "user" WHERE id=?',
        [userId],
        tx,
      );
      if (!user?.email.endsWith("@example.test"))
        throw new Error("Expected synthetic account");
      const credentials = await queryOne(
        "SELECT count(*) n FROM credentials WHERE enrollment_id IN (SELECT id FROM enrollments WHERE user_id=? AND version_id=?)",
        [userId, fixture.versionId],
        tx,
      );
      if (Number(credentials?.n))
        throw new Error("Refusing to reset document-associated records");
      await execute(
        "DELETE FROM idempotency_keys WHERE resource_id IN (SELECT id FROM enrollments WHERE user_id=? AND version_id=?) OR resource_id IN (SELECT a.id FROM attempts a JOIN enrollments e ON e.id=a.enrollment_id WHERE e.user_id=? AND e.version_id=?)",
        [userId, fixture.versionId, userId, fixture.versionId],
        tx,
      );
      await execute(
        "DELETE FROM attempts WHERE enrollment_id IN (SELECT id FROM enrollments WHERE user_id=? AND version_id=?)",
        [userId, fixture.versionId],
        tx,
      );
      await execute(
        "DELETE FROM lesson_progress WHERE enrollment_id IN (SELECT id FROM enrollments WHERE user_id=? AND version_id=?)",
        [userId, fixture.versionId],
        tx,
      );
      await execute(
        "DELETE FROM outbox WHERE type IN (?,?) AND aggregate_id IN (SELECT id FROM enrollments WHERE user_id=? AND version_id=?)",
        [
          "learning.enrolled",
          "notification.enrollment",
          userId,
          fixture.versionId,
        ],
        tx,
      );
      await execute(
        "DELETE FROM enrollments WHERE user_id=? AND version_id=?",
        [userId, fixture.versionId],
        tx,
      );
    }
  });
  console.log(
    "Reset learning records for the two isolated browser fixtures; audit history retained.",
  );
} finally {
  await closeDb();
}
