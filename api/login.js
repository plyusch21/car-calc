/**
 * /api/login — вход через Telegram OpenID Connect вне мини-приложения
 * (ТЗ 15). Authorization code + PKCE (S256), переход всей страницы (не
 * popup — в приложении «с экрана Домой» на iPhone всплывающие окна
 * ненадёжны). Документация: https://core.telegram.org/widgets/login,
 * discovery: https://oauth.telegram.org/.well-known/openid-configuration.
 *
 * POST {action:'start'}            → {url}  — адрес страницы Telegram
 * POST {action:'callback', code, state} → {session, name}
 *
 * state/code_verifier живут в KV «login:<state>» 10 минут, читаются один
 * раз (GETDEL). id_token проверяется целиком: подпись по JWKS (RS256 /
 * ES256 / EdDSA / ES256K — алгоритм из заголовка), iss, aud, exp. Из
 * claims берём id — числовой Telegram user id, тот же, что user.id в
 * initData мини-приложения (sub — служебный идентификатор OIDC, НЕ user id,
 * не использовать: так появился фантомный пользователь, ТЗ 15-а), name,
 * preferred_username. Итог — сессия
 * приложения (api/_lib/session.js), с которой ходят все остальные
 * запросы через authenticate(initData, session).
 *
 * Переменные окружения: TELEGRAM_LOGIN_CLIENT_ID, TELEGRAM_LOGIN_CLIENT_SECRET
 * (BotFather → Login Widget → OpenID Connect), SESSION_SECRET. Без npm —
 * только node:crypto.
 */

const crypto = require('crypto');
const { kv } = require('./_lib/kv');
const { issueSession, b64url, fromB64url } = require('./_lib/session');

// Ровно тот адрес, что зарегистрирован в BotFather (Redirect URIs, с косой
// чертой). Не из req.headers.host: на preview-доменах Telegram всё равно не
// пустит — вход через сайт проверяется только на боевом адресе.
const REDIRECT_URI = 'https://car-calc-eight.vercel.app/';
const ISSUER = 'https://oauth.telegram.org';
const AUTH_ENDPOINT = ISSUER + '/auth';
const TOKEN_ENDPOINT = ISSUER + '/token';
const JWKS_URL = ISSUER + '/.well-known/jwks.json';
const STATE_TTL_SEC = 600;
const FETCH_TIMEOUT_MS = 10000;
const JWKS_CACHE_MS = 3600 * 1000;

// Кэш JWKS в памяти функции на час; при неизвестном kid — перечитать один раз.
let jwksCache = { keys: null, at: 0 };

class LoginError extends Error {
  constructor(message, status) { super(message); this.status = status || 401; }
}

function envOrFail() {
  const clientId = process.env.TELEGRAM_LOGIN_CLIENT_ID;
  const clientSecret = process.env.TELEGRAM_LOGIN_CLIENT_SECRET;
  const sessionSecret = process.env.SESSION_SECRET;
  if (!clientId) throw new LoginError('вход через сайт не настроен (TELEGRAM_LOGIN_CLIENT_ID)', 500);
  if (!clientSecret) throw new LoginError('вход через сайт не настроен (TELEGRAM_LOGIN_CLIENT_SECRET)', 500);
  if (!sessionSecret) throw new LoginError('вход через сайт не настроен (SESSION_SECRET)', 500);
  return { clientId: String(clientId), clientSecret: String(clientSecret) };
}

async function fetchWithTimeout(url, opts) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, Object.assign({}, opts, { signal: ctrl.signal }));
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------- start
async function start() {
  const { clientId } = envOrFail();
  const state = b64url(crypto.randomBytes(32));
  const verifier = b64url(crypto.randomBytes(48)); // 64 символа, в пределах 43–128
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  await kv('SET', 'login:' + state, JSON.stringify({ verifier, createdAt: Date.now() }), 'EX', STATE_TTL_SEC);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    scope: 'openid profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  });
  return { url: AUTH_ENDPOINT + '?' + params.toString() };
}

// ------------------------------------------------------------- callback
async function loadJwks(force) {
  const fresh = jwksCache.keys && (Date.now() - jwksCache.at) < JWKS_CACHE_MS;
  if (fresh && !force) return jwksCache.keys;
  const r = await fetchWithTimeout(JWKS_URL, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new LoginError('Telegram не отдал ключи подписи (JWKS ' + r.status + ')', 502);
  const data = await r.json();
  if (!data || !Array.isArray(data.keys)) throw new LoginError('Telegram отдал ключи подписи в неожиданном виде', 502);
  jwksCache = { keys: data.keys, at: Date.now() };
  return data.keys;
}

async function findJwk(kid, alg) {
  const pick = (keys) => keys.find(k => (kid ? k.kid === kid : true) && (!alg || !k.alg || k.alg === alg));
  let key = pick(await loadJwks(false));
  if (!key) key = pick(await loadJwks(true));
  return key || null;
}

// Проверка подписи JWT средствами node:crypto — без npm-зависимостей.
function verifyJwtSignature(alg, jwk, signingInput, signature) {
  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const data = Buffer.from(signingInput, 'ascii');
  switch (alg) {
    case 'RS256':
      return crypto.verify('sha256', data, publicKey, signature);
    case 'ES256':
    case 'ES256K':
      // В JWT подпись ECDSA — сырые r||s (IEEE P1363), не DER.
      return crypto.verify('sha256', data, { key: publicKey, dsaEncoding: 'ieee-p1363' }, signature);
    case 'EdDSA':
      return crypto.verify(null, data, publicKey, signature);
    default:
      throw new LoginError('Неподдерживаемый алгоритм подписи id_token: ' + alg);
  }
}

async function verifyIdToken(idToken, clientId) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) throw new LoginError('Telegram вернул id_token в неожиданном виде');
  let header, claims;
  try {
    header = JSON.parse(fromB64url(parts[0]).toString('utf8'));
    claims = JSON.parse(fromB64url(parts[1]).toString('utf8'));
  } catch (e) { throw new LoginError('Не удалось разобрать id_token'); }
  const alg = header && header.alg;
  if (!alg || alg === 'none') throw new LoginError('id_token без подписи');
  const jwk = await findJwk(header.kid, alg);
  if (!jwk) throw new LoginError('Ключ подписи Telegram не найден (kid ' + (header.kid || '?') + ')');
  let ok = false;
  try {
    ok = verifyJwtSignature(alg, jwk, parts[0] + '.' + parts[1], fromB64url(parts[2]));
  } catch (e) {
    if (e instanceof LoginError) throw e;
    throw new LoginError('Не удалось проверить подпись id_token (' + alg + ')');
  }
  if (!ok) throw new LoginError('Подпись id_token не сошлась');
  if (claims.iss !== ISSUER) throw new LoginError('id_token выдан не Telegram (iss)');
  const aud = Array.isArray(claims.aud) ? claims.aud.map(String) : [String(claims.aud)];
  if (!aud.includes(clientId)) throw new LoginError('id_token выдан для другого приложения (aud)');
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(claims.exp) || claims.exp <= now) throw new LoginError('id_token уже истёк — попробуйте войти ещё раз');
  if (!claims.sub) throw new LoginError('В id_token нет идентификатора пользователя (sub)');
  return claims;
}

async function callback(body) {
  const { clientId, clientSecret } = envOrFail();
  const code = String(body.code || '');
  const state = String(body.state || '');
  if (!code || !state || !/^[A-Za-z0-9_-]{20,100}$/.test(state)) throw new LoginError('Неполный ответ от Telegram — попробуйте войти ещё раз');

  // Одноразово: второй заход по тому же адресу уже ничего не найдёт.
  const raw = await kv('GETDEL', 'login:' + state);
  if (!raw) throw new LoginError('Вход устарел, попробуйте ещё раз');
  let stored;
  try { stored = JSON.parse(raw); } catch (e) { stored = null; }
  if (!stored || !stored.verifier) throw new LoginError('Вход устарел, попробуйте ещё раз');

  // Обмен кода на токены. По документации — Basic-авторизация клиента,
  // client_id дублируется в теле (client_secret_basic).
  const form = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: clientId,
    code_verifier: stored.verifier
  });
  let tokenRes;
  try {
    tokenRes = await fetchWithTimeout(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        Authorization: 'Basic ' + Buffer.from(clientId + ':' + clientSecret, 'utf8').toString('base64')
      },
      body: form.toString()
    });
  } catch (e) {
    throw new LoginError('Telegram не ответил на обмен кода (' + (e.name === 'AbortError' ? 'таймаут' : 'сеть') + ')', 502);
  }
  let tokenData = null;
  try { tokenData = await tokenRes.json(); } catch (e) { tokenData = null; }
  if (!tokenRes.ok || !tokenData || !tokenData.id_token) {
    const reason = tokenData && (tokenData.error_description || tokenData.error);
    throw new LoginError('Telegram не подтвердил вход' + (reason ? ' (' + String(reason).slice(0, 120) + ')' : ' (HTTP ' + tokenRes.status + ')'));
  }

  const claims = await verifyIdToken(tokenData.id_token, clientId);
  // Telegram user id — только claim id (scope profile). Отката на sub нет
  // намеренно: sub служебный, и с ним человек молча становится новым
  // пользователем pending вместо себя самого (ТЗ 15-а).
  if (!/^\d+$/.test(String(claims.id ?? ''))) throw new LoginError('Telegram не передал идентификатор пользователя (id) — сообщите владельцу');
  const uid = String(claims.id);
  // Имя: given_name/family_name, если Telegram их прислал, иначе name целиком.
  const name = [claims.given_name, claims.family_name].filter(Boolean).join(' ') || String(claims.name || '').trim();
  const username = String(claims.preferred_username || '');

  return { session: issueSession({ uid, name, username }), name };
}

// ---------------------------------------------------------------- handler
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).send(JSON.stringify({ error: 'method not allowed' }));
    return;
  }
  let body = req.body;
  if (!body || typeof body === 'string') {
    try { body = JSON.parse(body || '{}'); } catch (e) { body = {}; }
  }
  try {
    if (body.action === 'start') {
      res.status(200).send(JSON.stringify(await start()));
    } else if (body.action === 'callback') {
      res.status(200).send(JSON.stringify(await callback(body)));
    } else {
      res.status(400).send(JSON.stringify({ error: 'unknown action' }));
    }
  } catch (e) {
    if (e instanceof LoginError) {
      res.status(e.status).send(JSON.stringify({ error: e.message }));
      return;
    }
    console.error('api/login error:', e);
    res.status(500).send(JSON.stringify({ error: 'Ошибка входа на сервере' }));
  }
};
