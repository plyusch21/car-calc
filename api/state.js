/**
 * /api/state — shared app state (settings + calculation history) so
 * every approved device sees the same data, not per-device localStorage.
 * Every call re-verifies Telegram initData and requires 'approved' status.
 *
 * KV schema: STRING "state:config" (JSON CONFIG blob), STRING
 * "state:history" (JSON array, capped at 500 entries server-side).
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
      const [configRaw, historyRaw] = await Promise.all([kv('GET', 'state:config'), kv('GET', 'state:history')]);
      res.status(200).send(JSON.stringify({
        config: configRaw ? JSON.parse(configRaw) : null,
        history: historyRaw ? JSON.parse(historyRaw) : null
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

    res.status(200).send(JSON.stringify({ error: 'неизвестное действие' }));
  } catch (e) {
    res.status(200).send(JSON.stringify({ error: e.message || String(e) }));
  }
};
