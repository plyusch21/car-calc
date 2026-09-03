/**
 * Verifies Telegram WebApp `initData` per Telegram's documented algorithm
 * (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):
 *   1. secret_key = HMAC_SHA256(bot_token, key="WebAppData")
 *   2. data_check_string = all fields except `hash`, "key=value" pairs
 *      sorted alphabetically by key and joined with "\n"
 *   3. computed_hash = HMAC_SHA256(data_check_string, key=secret_key), hex
 *   4. valid iff computed_hash === hash
 *
 * This is the ONLY trustworthy way to know who opened the mini app —
 * initDataUnsafe (parsed client-side) is not signed and must never be
 * used for access decisions, only for display.
 */

const crypto = require('crypto');

function verifyInitData(initData, botToken) {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const pairs = [];
  for (const [k, v] of params.entries()) pairs.push(k + '=' + v);
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const a = Buffer.from(computedHash, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const authDate = parseInt(params.get('auth_date') || '0', 10);
  const ageSec = Date.now() / 1000 - authDate;
  if (!authDate || ageSec > 86400 || ageSec < -60) return null; // старше суток или из будущего

  let user = null;
  try { user = JSON.parse(params.get('user') || 'null'); } catch (e) { /* noop */ }
  if (!user || !user.id) return null;

  return { user, authDate };
}

module.exports = { verifyInitData };
