/**
 * Access control on top of verified Telegram identity.
 *
 * KV schema:
 *   HASH "access"  field=telegram user id (string)
 *                  value=JSON { status, isOwner, name, username, requestedAt, approvedAt,
 *                               dealsLevel?, theme? }
 *   theme — личный выбор темы оформления ('dark'|'light'|'auto', ТЗ 13),
 *   пишется действием saveTheme в api/state.js; нет поля — пользователь
 *   тему ещё не выбирал.
 *
 * Bootstrap: the very first person ever to open the app (the hash is
 * empty) is auto-approved as the owner — expected to be whoever sets
 * this up and opens it first to test it. Everyone after that starts as
 * "pending" until the owner approves them from Settings.
 *
 * Два способа подтвердить личность (ТЗ 15), оба дают один и тот же
 * Telegram user id и проходят одну и ту же логику ниже:
 *   1) initData мини-приложения (подпись бота, verifyInitData) — как было;
 *   2) сессия приложения (api/_lib/session.js), выданная api/login.js
 *      после входа через Telegram OpenID Connect в обычном браузере.
 * Сначала initData (если есть и валиден), иначе сессия; нет ни того, ни
 * другого — прежняя ошибка, вызывающие отвечают 401.
 */

const { kv } = require('./kv');
const { verifyInitData } = require('./telegram');
const { verifySession } = require('./session');
const { sendOwnerMessage, escapeTg } = require('./notify');

async function authenticate(initData, session) {
  let user = null;
  let error = '';
  if (initData) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return { ok: false, error: 'TELEGRAM_BOT_TOKEN не настроен на сервере' };
    const verified = verifyInitData(initData, botToken);
    if (verified) user = verified.user;
    else error = 'Не удалось подтвердить данные Telegram (устарели или не совпадает подпись)';
  }
  if (!user && session) {
    const s = verifySession(session);
    if (s) {
      // В сессии имя одной строкой (как в id_token); first/last нужны только
      // чтобы результат совпадал по форме с путём через initData.
      const sp = s.name.indexOf(' ');
      user = {
        id: s.uid,
        first_name: sp > 0 ? s.name.slice(0, sp) : s.name,
        last_name: sp > 0 ? s.name.slice(sp + 1) : '',
        username: s.username
      };
    } else {
      error = 'Сессия недействительна или истекла — войдите заново';
    }
  }
  if (!user) return { ok: false, error: error || 'Не удалось подтвердить данные Telegram (устарели или не совпадает подпись)' };

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
    // Раньше о новой заявке владелец узнавал, только если сам заходил в
    // Настройки → Доступ к приложению (ЗАДАНИЕ.md Блок 10).
    if (!isFirstEver) {
      const who = escapeTg(name || 'без имени') + (username ? ' (@' + escapeTg(username) + ')' : '');
      // Ждём отправку: authenticate() вызывается из api/auth.js прямо перед
      // res.send — если не дождаться, serverless-функция может завершиться
      // раньше, чем уйдёт fetch к Bot API (см. notify.js).
      await sendOwnerMessage('🆕 Новая заявка на доступ: <b>' + who + '</b>. Одобрить — в Настройках → «Доступ к приложению».');
    }
  } else if (record.name !== name || record.username !== username) {
    record.name = name; record.username = username;
    await kv('HSET', 'access', uid, JSON.stringify(record));
  }

  return { ok: true, uid, user, record };
}

/**
 * Уровень доступа к разделу учёта сделок (/api/deals, deals.html):
 *   none      — раздела не видит вовсе
 *   own       — видит и правит только сделки, где он ответственный
 *   read_all  — видит все, правит только свои
 *   full      — всё, включая назначение ответственных и выгрузку
 *
 * Поля dealsLevel нет у тех, кто был одобрен до появления раздела —
 * по решению владельца они получают полный доступ, а сузить его можно
 * вручную в настройках. Отдельная миграция записей для этого не нужна:
 * значение вычисляется здесь при каждом чтении.
 */
function dealsLevelOf(record) {
  if (!record || record.status !== 'approved') return 'none';
  if (record.isOwner) return 'full';
  const lvl = record.dealsLevel;
  if (lvl === 'none' || lvl === 'own' || lvl === 'read_all' || lvl === 'full') return lvl;
  return 'full';
}

module.exports = { authenticate, dealsLevelOf };
