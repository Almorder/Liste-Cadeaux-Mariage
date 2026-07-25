import crypto from 'node:crypto';

const COOKIE_NAME = 'mn_admin_session';
const SESSION_DURATION_SECONDS = 12 * 60 * 60;

function constantTimeEqual(a, b) {
  const left = Buffer.from(String(a ?? ''), 'utf8');
  const right = Buffer.from(String(b ?? ''), 'utf8');
  if (left.length !== right.length) {
    const dummy = Buffer.alloc(left.length);
    crypto.timingSafeEqual(left, dummy);
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(value) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET doit contenir au moins 32 caractères.');
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

export function adminConfigurationStatus() {
  return {
    hasEmail: Boolean(String(process.env.ADMIN_EMAIL || '').trim()),
    hasPassword: Boolean(String(process.env.ADMIN_PASSWORD || '')),
    sessionSecretValid: String(process.env.SESSION_SECRET || '').length >= 32,
  };
}

export function assertAdminConfiguration() {
  const status = adminConfigurationStatus();
  if (!status.hasEmail) throw new Error('ADMIN_EMAIL est absent dans les variables Vercel de Production.');
  if (!status.hasPassword) throw new Error('ADMIN_PASSWORD est absent dans les variables Vercel de Production.');
  if (!status.sessionSecretValid) throw new Error('SESSION_SECRET doit contenir au moins 32 caractères dans Vercel.');
}

export function createSessionToken(email) {
  assertAdminConfiguration();
  const payload = {
    email,
    exp: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
  };
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifySessionToken(token) {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) return null;
  if (!token || !token.includes('.')) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature || !constantTimeEqual(signature, sign(encoded))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.email || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!constantTimeEqual(payload.email.toLowerCase(), String(process.env.ADMIN_EMAIL || '').trim().toLowerCase())) return null;
    return payload;
  } catch {
    return null;
  }
}

function readCookie(request, name) {
  const raw = request.headers.cookie || '';
  const cookies = raw.split(';').map((part) => part.trim()).filter(Boolean);
  for (const cookie of cookies) {
    const separator = cookie.indexOf('=');
    if (separator === -1) continue;
    if (cookie.slice(0, separator) === name) return decodeURIComponent(cookie.slice(separator + 1));
  }
  return null;
}

export function requireAdmin(request) {
  return verifySessionToken(readCookie(request, COOKIE_NAME));
}

export function credentialsAreValid(email, password) {
  assertAdminConfiguration();
  const expectedEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const expectedPassword = String(process.env.ADMIN_PASSWORD || '');
  return constantTimeEqual(String(email || '').trim().toLowerCase(), expectedEmail)
    && constantTimeEqual(String(password || ''), expectedPassword);
}

export function setSessionCookie(response, token) {
  response.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DURATION_SECONDS}`);
}

export function clearSessionCookie(response) {
  response.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}
