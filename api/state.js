/**
 * /api/state — shared app state (settings + calculation history) so
 * every approved device sees the same data, not per-device localStorage.
 * Every call re-verifies Telegram initData and requires 'approved' status.
 *
 * KV schema: STRING "state:config" (JSON CONFIG blob) + STRING
 * "state:config:v" (plain integer, optimistic-concurrency version — see
 * saveConfig below); STRING "state:history:<uid>" (JSON array, capped at
 * 500 entries server-side, ONE PER USER — see ЗАДАНИЕ.md Блок 9: this used
 * to be a single shared "state:history" key, which meant two people saving
 * around the same time would silently clobber each other's history; the
 * legacy key is migrated once per user into their own on first read, then
 * left alone); STRING "state:archive:<uid>" (JSON array, capped at 50, ONE
 * PER USER — same split and same one-time legacy migration as history, see
 * ТЗ/02-сверка.md п.3). Rate history (Блок 8)
 * lives under its own "rates:hist:<ID>" sorted-set keys — see
 * api/_lib/rateHistory.js — also not inside state:config for the same
 * "don't make one key do two jobs" reason.
 */

const { kv } = require('./_lib/kv');
const { authenticate } = require('./_lib/access');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'POST') {
    res.status(405).send(JSON.stringify({ error: 'method not allowed' }));
    return;
  }

  let body = req.body;
  if (!body || typeof body === 'string') {
    try { body = JSON.parse(body || '{}'); } catch (e) { body = {}; }
  }

  try {
    const auth = await authenticate(body.initData);
    if (!auth.ok) { res.status(401).send(JSON.stringify({ error: auth.error })); return; }
    if (auth.record.status !== 'approved') {
      res.status(401).send(JSON.stringify({ error: 'доступ не подтверждён', status: auth.record.status }));
      return;
    }

    const action = body.action;
    const historyKey = 'state:history:' + auth.uid;
    const archiveKey = 'state:archive:' + auth.uid;

    if (action === 'get') {
      const [configRaw, configVerRaw, historyRaw, archiveRaw] = await Promise.all([
        kv('GET', 'state:config'), kv('GET', 'state:config:v'), kv('GET', historyKey), kv('GET', archiveKey)
      ]);
      let history = historyRaw ? JSON.parse(historyRaw) : null;
      // Разовая миграция: раньше была одна общая "state:history" на всех —
      // владелец, скорее всего, единственный, кто ею пользовался. Переносим
      // в его личный ключ при первом чтении, если у него своего ещё нет.
      if (history === null && auth.record.isOwner) {
        const legacyRaw = await kv('GET', 'state:history');
        if (legacyRaw) {
          history = JSON.parse(legacyRaw);
          await kv('SET', historyKey, legacyRaw);
        }
      }
      let archive = archiveRaw ? JSON.parse(archiveRaw) : null;
      // Та же разовая миграция для архива — раньше был один общий "state:archive".
      if (archive === null && auth.record.isOwner) {
        const legacyArchiveRaw = await kv('GET', 'state:archive');
        if (legacyArchiveRaw) {
          archive = JSON.parse(legacyArchiveRaw);
          await kv('SET', archiveKey, legacyArchiveRaw);
        }
      }
      res.status(200).send(JSON.stringify({
        config: configRaw ? JSON.parse(configRaw) : null,
        configVersion: configVerRaw ? parseInt(configVerRaw, 10) : 0,
        history,
        archive
      }));
      return;
    }

    if (action === 'saveConfig') {
      // Оптимистичная блокировка (ЗАДАНИЕ.md Блок 9): настройки общие на всю
      // организацию, и раньше кто угодно мог молча затереть чужую правку,
      // сохранённую параллельно. Клиент присылает версию, которую он читал
      // (configVersion); если она не совпадает с текущей — значит, кто-то
      // уже сохранил более новую версию, отказываем и просим перечитать,
      // а не затираем её. Небольшое окно гонки между чтением версии и
      // записью здесь всё равно остаётся (простой REST-KV без транзакций),
      // но это на порядки лучше, чем не проверять вообще ничего — реальная
      // одновременная правка настроек двумя менеджерами случается редко.
      const clientVersion = Number.isFinite(body.configVersion) ? body.configVersion : parseInt(body.configVersion, 10);
      if (!Number.isFinite(clientVersion)) {
        res.status(400).send(JSON.stringify({ error: 'нет configVersion — пришлите версию, которую читали' }));
        return;
      }
      const currentVerRaw = await kv('GET', 'state:config:v');
      const currentVersion = currentVerRaw ? parseInt(currentVerRaw, 10) : 0;
      if (clientVersion !== currentVersion) {
        res.status(409).send(JSON.stringify({
          error: 'Настройки уже изменил кто-то другой — перезагрузите и повторите правку.',
          configVersion: currentVersion
        }));
        return;
      }
      const newVersion = currentVersion + 1;
      await kv('SET', 'state:config', JSON.stringify(body.config || {}));
      await kv('SET', 'state:config:v', String(newVersion));
      res.status(200).send(JSON.stringify({ ok: true, configVersion: newVersion }));
      return;
    }

    if (action === 'saveHistory') {
      const history = Array.isArray(body.history) ? body.history.slice(0, 500) : [];
      await kv('SET', historyKey, JSON.stringify(history));
      res.status(200).send(JSON.stringify({ ok: true }));
      return;
    }

    if (action === 'saveArchive') {
      const archive = Array.isArray(body.archive) ? body.archive.slice(0, 50) : [];
      await kv('SET', archiveKey, JSON.stringify(archive));
      res.status(200).send(JSON.stringify({ ok: true }));
      return;
    }

    // История курсов (ЗАДАНИЕ.md Блок 8) — см. api/_lib/rateHistory.js.
    if (action === 'logRate') {
      const id = String(body.rateId || '');
      if (!id || !body.entry) { res.status(400).send(JSON.stringify({ error: 'нет rateId/entry' })); return; }
      const { logRate } = require('./_lib/rateHistory');
      await logRate(id, { raw: body.entry.raw, value: body.entry.value, source: body.entry.source || null });
      res.status(200).send(JSON.stringify({ ok: true }));
      return;
    }

    if (action === 'getRateHistory') {
      const id = String(body.rateId || '');
      if (!id) { res.status(400).send(JSON.stringify({ error: 'нет rateId' })); return; }
      const { getRateHistory } = require('./_lib/rateHistory');
      const history = await getRateHistory(id);
      res.status(200).send(JSON.stringify({ history }));
      return;
    }

    res.status(400).send(JSON.stringify({ error: 'неизвестное действие' }));
  } catch (e) {
    console.error('api/state error:', e);
    res.status(500).send(JSON.stringify({ error: e.message || String(e) }));
  }
};
