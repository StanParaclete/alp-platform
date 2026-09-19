import { database } from '../src/db.mjs';
import { bootstrapInput, bootstrapSchool } from '../src/onboarding.mjs';

let db;
try {
  if (process.argv.slice(2).some(arg=>arg !== '--apply')) throw new Error('Only --apply is accepted. Supply credentials through the process environment, never command-line arguments.');
  const env = process.env;
  const url = new URL(env.ALP_BOOTSTRAP_DATABASE_URL);
  if (!['postgres:','postgresql:'].includes(url.protocol) || !url.hostname || url.pathname === '/' || url.hostname.endsWith('supabase.co') || url.hostname.endsWith('supabase.com')) throw new Error('Use a separate ecosystem PostgreSQL database, never live Supabase.');
  const input = bootstrapInput.parse({email:env.ALP_BOOTSTRAP_EMAIL,name:env.ALP_BOOTSTRAP_NAME,password:env.ALP_BOOTSTRAP_PASSWORD,schoolName:env.ALP_BOOTSTRAP_SCHOOL,country:env.ALP_BOOTSTRAP_COUNTRY,timezone:env.ALP_BOOTSTRAP_TIMEZONE});
  const target = `${url.hostname}:${url.port || '5432'}${url.pathname}`;
  if (!process.argv.includes('--apply')) {
    console.log(`Configuration valid. No connection or changes made. Target: ${target}. To apply, set ALP_BOOTSTRAP_CONFIRM to this target and run with --apply.`);
  } else {
    if (env.ALP_BOOTSTRAP_CONFIRM !== target) throw new Error('ALP_BOOTSTRAP_CONFIRM must match the exact target reported by the dry run.');
    db = database({DATABASE_URL:url.href});
    const result = await bootstrapSchool(db,input);
    console.log(JSON.stringify({created:true,...result}));
  }
} catch (error) {
  console.error(db ? 'Bootstrap failed. No credentials printed; inspect the empty-database requirement and database health before retrying.' : error.name === 'ZodError' ? 'Bootstrap fields are missing or invalid. Check the onboarding guide.' : error.message);
  process.exitCode = 1;
} finally { if (db) await db.$disconnect(); }
