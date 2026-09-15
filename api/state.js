/**
 * /api/state — shared app state (settings + calculation history) so
 * every approved device sees the same data, not per-device localStorage.
 * Every call re-verifies Telegram initData and requires 'approved' status.
 *
 * KV schema: STRING "state:config" (JSON CONFIG blob), STRING
 * "state:history" (JSON array, capped at 500 entries server-side), STRING
 * "state:archive" (JSON array, capped at 50 — every calc that reached a
 * result, automatic, separate from the manually-curated "history" above;
 * see ЗАДАНИЕ.md Блок 3 — deliberately its own key, not folded into
 * state:history, so the two caps/purposes don't collide). Rate history
 * (ЗАДАНИЕ.md Блок 8) lives under its own "rates:hist:<ID>" sorted-set keys,
 * one per currency — see api/_lib/rateHistory.js — also not inside
 * state:config for the same reason.
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
    if (!auth.ok) { res.status(200).send(JSON.stringify({ error: auth.error })); return; }
    if (auth.record.status !== 'approved') {
      res.status(200).send(JSON.stringify({ error: 'доступ не подтверждён', status: auth.record.status }));
      return;
    }

    const action = body.action;

    if (action === 'get') {
      const [configRaw, historyRaw, archiveRaw] = await Promise.all([
        kv('GET', 'state:config'), kv('GET', 'state:history'), kv('GET', 'state:archive')
      ]);
      res.status(200).send(JSON.stringify({
        config: configRaw ? JSON.parse(configRaw) : null,
        history: historyRaw ? JSON.parse(historyRaw) : null,
        archive: archiveRaw ? JSON.parse(archiveRaw) : null
      }));
      return;
    }

    if (action === 'saveConfig') {
      await kv('SET', 'state:config', JSON.stringify(body.config || {}));
      res.status(200).send(JSON.stringify({ ok: true }));
      return;
    }

    if (action === 'saveHistory') {
      const history = Array.isArray(body.history) ? body.history.slice(0, 500) : [];
      await kv('SET', 'state:history', JSON.stringify(history));
      res.status(200).send(JSON.stringify({ ok: true }));
      return;
    }

    if (action === 'saveArchive') {
      const archive = Array.isArray(body.archive) ? body.archive.slice(0, 50) : [];
      await kv('SET', 'state:archive', JSON.stringify(archive));
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

    res.status(200).send(JSON.stringify({ error: 'неизвестное действие' }));
  } catch (e) {
    res.status(200).send(JSON.stringify({ error: e.message || String(e) }));
  }
};
