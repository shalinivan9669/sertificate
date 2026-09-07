import { defineEventHandler, setResponseStatus } from 'h3';
import { queryAll } from '../db';
const requiredMigrations = ['001-core.sql', '002-business.sql', '003-credential-templates.sql', '004-corporate-invoices.sql', '005-invoice-allocations.sql'];
export default defineEventHandler(async event => {
  try {
    const migrations = await queryAll<{ name: string }>('SELECT name FROM schema_migrations');
    if (!requiredMigrations.every(name => migrations.some(row => row.name === name))) throw new Error('Schema incomplete');
    return { status: 'ready' };
  }
  catch { setResponseStatus(event, 503); return { status: 'unavailable', code: 'DATABASE_UNAVAILABLE' }; }
});
