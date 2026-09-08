/** Test-only SELECT observer; never retry application writes or hide a persistent lock. */
const backoffMs = [25, 50, 100, 150, 200, 250, 250];

/**
 * @param {Pick<import('@libsql/client').Client, 'execute'>} db
 * @param {string} sql
 * @param {import('@libsql/client').InArgs} args
 * @returns {Promise<import('@libsql/client').Row[]>}
 */
export async function readBrowserRows(db, sql, args = []) {
  if (!/^\s*SELECT\s/i.test(sql) || sql.includes(';')) throw new Error('Browser observer accepts one SELECT statement only');
  for (let attempt = 0; ; attempt++) {
    try { return (await db.execute({ sql, args })).rows; }
    catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
      if (!['SQLITE_BUSY', 'SQLITE_LOCKED'].includes(code) || attempt >= backoffMs.length) throw error;
      await new Promise(resolve => setTimeout(resolve, backoffMs[attempt]));
    }
  }
}
