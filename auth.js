import { createHmac, timingSafeEqual } from 'node:crypto';

const launchMaxAgeSeconds = 60 * 60;
const sessionMaxAgeSeconds = 60 * 60;
const cookieName = 'hideout_session';

function mac(key, value) {
  return createHmac('sha256', key).update(value).digest();
}

function sameHash(expected, received) {
  if (!/^[0-9a-f]{64}$/i.test(received || '')) return false;
  return timingSafeEqual(expected, Buffer.from(received, 'hex'));
}

export function verifyInitData(raw, botToken, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 8192) return null;
  const params = new URLSearchParams(raw);
  const fields = [...params];
  if (new Set(fields.map(([key]) => key)).size !== fields.length) return null;
  const hash = params.get('hash');
  const check = fields
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = mac('WebAppData', botToken);
  if (!sameHash(mac(secret, check), hash)) return null;

  const authDate = Number(params.get('auth_date'));
  if (!Number.isSafeInteger(authDate) || authDate > nowSeconds + 60 || nowSeconds - authDate > launchMaxAgeSeconds) return null;
  try {
    const user = JSON.parse(params.get('user'));
    if (!Number.isSafeInteger(user.id) || user.id <= 0 || typeof user.first_name !== 'string' || !user.first_name.trim()) return null;
    const name = typeof user.username === 'string' && user.username ? `@${user.username}` : user.first_name.trim();
    return { id: user.id, name: name.slice(0, 100) };
  } catch {
    return null;
  }
}

function sessionKey(botToken) {
  return mac(botToken, 'hideout-session-v1');
}

export function makeSession(user, botToken, nowSeconds = Math.floor(Date.now() / 1000)) {
  const payload = Buffer.from(JSON.stringify({ id: user.id, name: user.name, exp: nowSeconds + sessionMaxAgeSeconds })).toString('base64url');
  return `${payload}.${mac(sessionKey(botToken), payload).toString('hex')}`;
}

export function readSession(cookieHeader, botToken, nowSeconds = Math.floor(Date.now() / 1000)) {
  const cookie = (cookieHeader || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`));
  if (!cookie) return null;
  const value = cookie.slice(cookieName.length + 1);
  const parts = value.split('.');
  if (parts.length !== 2 || !sameHash(mac(sessionKey(botToken), parts[0]), parts[1])) return null;
  try {
    const session = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    if (!Number.isSafeInteger(session.id) || session.id <= 0 || typeof session.name !== 'string' || !Number.isSafeInteger(session.exp) || session.exp <= nowSeconds) return null;
    return session;
  } catch {
    return null;
  }
}

export function sessionCookie(value) {
  return `${cookieName}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${sessionMaxAgeSeconds}`;
}
