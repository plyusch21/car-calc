/**
 * Access control on top of verified Telegram identity.
 *
 * KV schema:
 *   HASH "access"  field=telegram user id (string)
 *                  value=JSON { status, isOwner, name, username, requestedAt, approvedAt }
 *
 * Bootstrap: the very first person ever to open the app (the hash is
 * empty) is auto-approved as the owner — expected to be whoever sets
 * this up and opens it first to test it. Everyone after that starts as
 * "pending" until the owner approves them from Settings.
 */

const { kv } = require('./kv');
const { verifyInitData } = require('./telegram');

async function authenticate(initData) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return { ok: false, error: 'TELEGRAM_BOT_TOKEN не настроен на сервере' };

  const verified = verifyInitData(initData, botToken);
  if (!verified) return { ok: false, error: 'Не удалось подтвердить данные Telegram (устарели или не совпадает подпись)' };

  const { user } = verified;
  const uid = String(user.id);
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
  const username = user.username || '';

  const raw = await kv('HGET', 'access', uid);
  let record = raw ? JSON.parse(raw) : null;

  if (!record) {
    const allRaw = await kv('HGETALL', 'access');
    const isFirstEver = !allRaw || allRaw.length === 0;
    record = {
      status: isFirstEver ? 'approved' : 'pending',
      isOwner: isFirstEver,
      name, username,
      requestedAt: Date.now(),
      approvedAt: isFirstEver ? Date.now() : null
    };
    await kv('HSET', 'access', uid, JSON.stringify(record));
  } else if (record.name !== name || record.username !== username) {
    record.name = name; record.username = username;
    await kv('HSET', 'access', uid, JSON.stringify(record));
  }

  return { ok: true, uid, user, record };
}

module.exports = { authenticate };
