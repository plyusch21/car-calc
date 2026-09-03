/**
 * /api/admin — owner-only: list everyone who has ever opened the app,
 * approve a pending request, or revoke someone's access. Every call
 * re-verifies the caller's Telegram initData AND checks they're the
 * owner server-side — never trust the client's own idea of who it is.
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
    if (!auth.record.isOwner) { res.status(200).send(JSON.stringify({ error: 'Доступ к этому разделу — только у владельца' })); return; }

    const action = body.action;

    if (action === 'list') {
      const allRaw = await kv('HGETALL', 'access'); // [field, value, field, value, ...] | null
      const users = [];
      for (let i = 0; i < (allRaw || []).length; i += 2) {
        users.push({ id: allRaw[i], ...JSON.parse(allRaw[i + 1]) });
      }
      users.sort((a, b) => (b.requestedAt || 0) - (a.requestedAt || 0));
      res.status(200).send(JSON.stringify({ users }));
      return;
    }

    if (action === 'approve' || action === 'revoke') {
      const targetId = String(body.targetId || '');
      if (!targetId) { res.status(200).send(JSON.stringify({ error: 'targetId обязателен' })); return; }
      const raw = await kv('HGET', 'access', targetId);
      if (!raw) { res.status(200).send(JSON.stringify({ error: 'пользователь не найден' })); return; }
      const record = JSON.parse(raw);
      if (record.isOwner) { res.status(200).send(JSON.stringify({ error: 'нельзя менять доступ владельца' })); return; }
      record.status = action === 'approve' ? 'approved' : 'revoked';
      if (action === 'approve') record.approvedAt = Date.now();
      await kv('HSET', 'access', targetId, JSON.stringify(record));
      res.status(200).send(JSON.stringify({ ok: true }));
      return;
    }

    res.status(200).send(JSON.stringify({ error: 'неизвестное действие' }));
  } catch (e) {
    res.status(200).send(JSON.stringify({ error: e.message || String(e) }));
  }
};
