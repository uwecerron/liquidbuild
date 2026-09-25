// Team logins: scrypt password hashes + HMAC-signed session cookies. No external services.
const crypto = require('node:crypto');
const { db, migrate } = require('./db');

const COOKIE = 'lb_session';
const MAX_AGE = 60 * 60 * 24 * 14; // 14 days

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw Object.assign(new Error('SESSION_SECRET is not set (use a long random string).'), { status: 503 });
  return s;
}

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pw), salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function checkPassword(pw, stored) {
  const [alg, saltB64, hashB64] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const got = crypto.scryptSync(String(pw), Buffer.from(saltB64, 'base64'), expected.length);
  return crypto.timingSafeEqual(expected, got);
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function verify(token) {
  const [body, mac] = String(token || '').split('.');
  if (!body || !mac) return null;
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > Date.now() / 1000 ? p : null;
  } catch { return null; }
}

function parseCookies(header) {
  return Object.fromEntries(String(header || '').split(';').map((c) => c.trim().split('=')).filter((p) => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
}

function sessionCookie(user) {
  const token = sign({ uid: user.id, exp: Math.floor(Date.now() / 1000) + MAX_AGE });
  const secure = process.env.VERCEL || process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`;
}
const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

// First run: if no users exist, create the admin from ADMIN_EMAIL / ADMIN_PASSWORD env vars.
async function ensureAdmin() {
  await migrate();
  const s = db();
  const [{ count }] = await s`SELECT count(*)::int AS count FROM users`;
  if (count > 0) return;
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const pw = process.env.ADMIN_PASSWORD || '';
  if (!email || pw.length < 8) return;
  await s`INSERT INTO users (email, name, role, password_hash) VALUES (${email}, ${process.env.ADMIN_NAME || 'Admin'}, 'admin', ${hashPassword(pw)}) ON CONFLICT (email) DO NOTHING`;
}

async function currentUser(req) {
  const p = verify(parseCookies(req.headers.cookie)[COOKIE]);
  if (!p) return null;
  const [u] = await db()`SELECT id, email, name, phone, role FROM users WHERE id = ${p.uid} AND active`;
  return u || null;
}

async function login(email, password) {
  await ensureAdmin();
  const [u] = await db()`SELECT * FROM users WHERE email = ${String(email || '').trim().toLowerCase()} AND active`;
  if (!u || !checkPassword(password, u.password_hash)) return null;
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

module.exports = { hashPassword, checkPassword, currentUser, login, sessionCookie, clearCookie, ensureAdmin };
