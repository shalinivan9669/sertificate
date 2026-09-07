import { defineEventHandler, setResponseStatus } from 'h3';
import { queryAll } from '../db';
import { requiredMigrations } from '../db/required-migrations';
export default defineEventHandler(async event => {
  try {
    const migrations = await queryAll<{ name: string }>('SELECT name FROM schema_migrations');
    if (!requiredMigrations.every(name => migrations.some(row => row.name === name))) throw new Error('Schema incomplete');
    return { status: 'ready' };
  }
  catch { setResponseStatus(event, 503); return { status: 'unavailable', code: 'DATABASE_UNAVAILABLE' }; }
});
