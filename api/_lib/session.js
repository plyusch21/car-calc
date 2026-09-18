/**
 * Сессия приложения для входа вне Telegram (ТЗ 15).
 *
 * Строка вида
 *   <base64url(JSON{uid, name, username, iat, exp})>.<base64url(HMAC-SHA256 по SESSION_SECRET)>
 * Срок 90 дней. Выпускается только api/login.js после успешного входа
 * через Telegram OpenID Connect и хранится у клиента в localStorage
 * (bk_session_v1). Серверного списка сессий нет: «Выйти» стирает строку у
 * клиента, отозвать чей-то вход владелец может статусом revoked в «Доступе
 * к приложению» (проверяется при каждом запросе), все сессии разом —
 * сменой SESSION_SECRET в Vercel.
 */

const crypto = require('crypto');

const SESSION_TTL_SEC = 90 * 24 * 3600;

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s) {
  return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function sign(payloadB64, secret) {
  return b64url(crypto.createHmac('sha256', secret).update(payloadB64).digest());
}

function issueSession({ uid, name, username }) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('вход через сайт не настроен (SESSION_SECRET)');
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({
    uid: String(uid), name: name || '', username: username || '',
    iat: now, exp: now + SESSION_TTL_SEC
  }));
  return payload + '.' + sign(payload, secret);
}

// Возвращает {uid, name, username} или null (подпись не сошлась, истекла,
// секрет не задан). Ничего не бросает — вызывающий сам решает, что показать.
function verifySession(session) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || typeof session !== 'string') return null;
  const dot = session.indexOf('.');
  if (dot <= 0) return null;
  const payloadB64 = session.slice(0, dot);
  const sigB64 = session.slice(dot + 1);
  let a, b;
  try { a = fromB64url(sign(payloadB64, secret)); b = fromB64url(sigB64); } catch (e) { return null; }
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let data;
  try { data = JSON.parse(fromB64url(payloadB64).toString('utf8')); } catch (e) { return null; }
  if (!data || !data.uid || !Number.isFinite(data.exp)) return null;
  if (data.exp <= Math.floor(Date.now() / 1000)) return null;
  return { uid: String(data.uid), name: data.name || '', username: data.username || '' };
}

module.exports = { issueSession, verifySession, b64url, fromB64url, SESSION_TTL_SEC };
