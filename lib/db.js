// Postgres access (Neon on Vercel, any Postgres locally). Tables are created automatically.
const postgres = require('postgres');

let sql = null;
let migrated = null;

function hasDb() { return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL); }

function db() {
  if (!hasDb()) throw Object.assign(new Error('Database not configured. Add DATABASE_URL (e.g. from Neon) in Vercel settings.'), { status: 503 });
  if (!sql) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    const local = /localhost|127\.0\.0\.1|\/tmp|host=\//.test(url);
    sql = postgres(url, { max: 1, idle_timeout: 20, connect_timeout: 10, prepare: false, ssl: local ? false : 'require', onnotice: () => {} });
  }
  return sql;
}

const STAGES = ['new', 'contacted', 'site_visit', 'bid_sent', 'won', 'lost'];

async function migrate() {
  if (migrated) return migrated;
  const s = db();
  migrated = (async () => {
    await s`CREATE TABLE IF NOT EXISTS users (
      id serial PRIMARY KEY, email text UNIQUE NOT NULL, name text NOT NULL DEFAULT '',
      phone text, role text NOT NULL DEFAULT 'member', password_hash text NOT NULL,
      active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now())`;
    await s`CREATE TABLE IF NOT EXISTS leads (
      id serial PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      name text NOT NULL DEFAULT '', email text, phone text, project text, location text, details text,
      source text NOT NULL DEFAULT 'website', page text, stage text NOT NULL DEFAULT 'new',
      assigned_to integer REFERENCES users(id) ON DELETE SET NULL, value numeric, next_follow_up date,
      sms_consent boolean NOT NULL DEFAULT false, sms_opt_out boolean NOT NULL DEFAULT false,
      last_activity_at timestamptz NOT NULL DEFAULT now(), unread integer NOT NULL DEFAULT 0)`;
    await s`ALTER TABLE leads ADD COLUMN IF NOT EXISTS intent text, ADD COLUMN IF NOT EXISTS budget text, ADD COLUMN IF NOT EXISTS timeline text,
      ADD COLUMN IF NOT EXISTS contact_pref text, ADD COLUMN IF NOT EXISTS files jsonb NOT NULL DEFAULT '[]'::jsonb`;
    await s`CREATE INDEX IF NOT EXISTS leads_stage_idx ON leads(stage)`;
    await s`CREATE INDEX IF NOT EXISTS leads_phone_idx ON leads(phone)`;
    await s`CREATE TABLE IF NOT EXISTS activities (
      id serial PRIMARY KEY, lead_id integer NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      type text NOT NULL, body text NOT NULL DEFAULT '', meta jsonb NOT NULL DEFAULT '{}'::jsonb,
      user_id integer REFERENCES users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now())`;
    await s`CREATE INDEX IF NOT EXISTS activities_lead_idx ON activities(lead_id, created_at)`;
    await s`CREATE TABLE IF NOT EXISTS bids (
      id serial PRIMARY KEY, lead_id integer NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      title text NOT NULL DEFAULT 'Estimate', amount numeric NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'draft',
      scope text NOT NULL DEFAULT '', valid_until date, sent_at timestamptz, created_by integer REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`;
  })().catch((e) => { migrated = null; throw e; });
  return migrated;
}

// Normalize a US phone number to E.164 (+1XXXXXXXXXX). Returns '' if it can't.
function e164(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10) return '+1' + d;
  if (d.length === 11 && d.startsWith('1')) return '+' + d;
  if (String(phone || '').trim().startsWith('+') && d.length >= 8) return '+' + d;
  return '';
}

async function addActivity(leadId, type, body, meta = {}, userId = null) {
  const s = db();
  const [a] = await s`INSERT INTO activities (lead_id, type, body, meta, user_id) VALUES (${leadId}, ${type}, ${body || ''}, ${s.json(meta)}, ${userId}) RETURNING *`;
  await s`UPDATE leads SET last_activity_at = now(), updated_at = now(), unread = unread + ${type === 'sms_in' || type === 'lead_created' ? 1 : 0} WHERE id = ${leadId}`;
  return a;
}

module.exports = { db, hasDb, migrate, STAGES, e164, addActivity };
