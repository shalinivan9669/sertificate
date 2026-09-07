import { bootstrapAdministrator } from '../server/services/core-administration';
import { closeDb } from '../server/db';

const args = process.argv.slice(2);
const emailIndex = args.indexOf('--email'); const reasonIndex = args.indexOf('--reason');
if (!args.includes('--bootstrap') || emailIndex < 0 || reasonIndex < 0 || !args[emailIndex + 1] || !args[reasonIndex + 1]) {
  console.error('Usage: node --import tsx scripts/core-admin.ts --bootstrap --email owner@example.com --reason "Owner authorized initial administrator"');
  process.exitCode = 1;
} else {
  try { console.log(JSON.stringify(await bootstrapAdministrator(args[emailIndex + 1]!, args[reasonIndex + 1]!), null, 2)); }
  catch (error: any) { console.error(error?.data?.message || 'Administrator bootstrap failed. Check database configuration and account verification.'); process.exitCode = 1; }
  finally { await closeDb(); }
}
