/**
 * /api/admin — owner-only: list everyone who has ever opened the app,
 * approve a pending request, or revoke someone's access. Every call
 * re-verifies the caller's Telegram initData AND checks they're the
 * owner server-side — never trust the client's own idea of who it is.
 */

const { kv } = require('./_lib/kv');
const { authenticate, dealsLevelOf } = require('./_lib/access');
const { sendTelegramMessage } = require('./_lib/notify');

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
    const auth = await authenticate(body.initData, body.session);
    if (!auth.ok) { res.status(401).send(JSON.stringify({ error: auth.error })); return; }
    if (!auth.record.isOwner) { res.status(401).send(JSON.stringify({ error: 'Доступ к этому разделу — только у владельца' })); return; }

    const action = body.action;

    if (action === 'list') {
      const allRaw = await kv('HGETALL', 'access'); // [field, value, field, value, ...] | null
      const users = [];
      for (let i = 0; i < (allRaw || []).length; i += 2) {
        const record = JSON.parse(allRaw[i + 1]);
        // dealsLevel считаем, а не берём из записи: у одобренных до появления
        // раздела поля нет вовсе (см. dealsLevelOf).
        users.push({ id: allRaw[i], ...record, dealsLevel: dealsLevelOf(record) });
      }
      users.sort((a, b) => (b.requestedAt || 0) - (a.requestedAt || 0));
      res.status(200).send(JSON.stringify({ users }));
      return;
    }

    if (action === 'approve' || action === 'revoke') {
      const targetId = String(body.targetId || '');
      if (!targetId) { res.status(400).send(JSON.stringify({ error: 'targetId обязателен' })); return; }
      const raw = await kv('HGET', 'access', targetId);
      if (!raw) { res.status(400).send(JSON.stringify({ error: 'пользователь не найден' })); return; }
      const record = JSON.parse(raw);
      if (record.isOwner) { res.status(400).send(JSON.stringify({ error: 'нельзя менять доступ владельца' })); return; }
      record.status = action === 'approve' ? 'approved' : 'revoked';
      if (action === 'approve') record.approvedAt = Date.now();
      await kv('HSET', 'access', targetId, JSON.stringify(record));
      // Уведомление тому, кого одобрили, а не владельцу — это же он сам
      // только что нажал «Одобрить» и так знает результат (ЗАДАНИЕ.md Блок 10).
      // Раньше человек узнавал об одобрении, только заново открыв приложение
      // и нажав «Проверить ещё раз» на экране ожидания.
      if (action === 'approve') {
        await sendTelegramMessage(targetId, '✅ Доступ к приложению одобрен — можно открывать калькулятор.');
      }
      res.status(200).send(JSON.stringify({ ok: true }));
      return;
    }

    // Удаление записи (ТЗ 15-а): для ошибочных/фантомных заявок. Только
    // pending/revoked (клиент не показывает кнопку у approved — сначала
    // «Закрыть»), не себя и не владельца. Подтверждения не нужно: при
    // следующем входе человека запись создастся заново как pending.
    if (action === 'remove') {
      const targetId = String(body.targetId || '');
      if (!targetId) { res.status(400).send(JSON.stringify({ error: 'targetId обязателен' })); return; }
      if (targetId === auth.uid) { res.status(400).send(JSON.stringify({ error: 'нельзя удалить самого себя' })); return; }
      const raw = await kv('HGET', 'access', targetId);
      if (!raw) { res.status(400).send(JSON.stringify({ error: 'пользователь не найден' })); return; }
      const record = JSON.parse(raw);
      if (record.isOwner) { res.status(400).send(JSON.stringify({ error: 'нельзя удалить владельца' })); return; }
      if (record.status === 'approved') { res.status(400).send(JSON.stringify({ error: 'сначала закройте доступ' })); return; }
      await kv('HDEL', 'access', targetId);
      res.status(200).send(JSON.stringify({ ok: true }));
      return;
    }

    // Уровень доступа к разделу учёта сделок. Владелец всегда полный —
    // менять его нельзя, иначе можно случайно запереть самого себя.
    if (action === 'setDealsLevel') {
      const targetId = String(body.targetId || '');
      const levelRaw = String(body.level || '');
      if (['none', 'own', 'read_all', 'full'].indexOf(levelRaw) === -1) {
        res.status(400).send(JSON.stringify({ error: 'неизвестный уровень доступа' }));
        return;
      }
      const raw = await kv('HGET', 'access', targetId);
      if (!raw) { res.status(400).send(JSON.stringify({ error: 'пользователь не найден' })); return; }
      const record = JSON.parse(raw);
      if (record.isOwner) { res.status(400).send(JSON.stringify({ error: 'у владельца всегда полный доступ' })); return; }
      record.dealsLevel = levelRaw;
      await kv('HSET', 'access', targetId, JSON.stringify(record));
      res.status(200).send(JSON.stringify({ ok: true }));
      return;
    }

    res.status(400).send(JSON.stringify({ error: 'неизвестное действие' }));
  } catch (e) {
    console.error('api/admin error:', e);
    res.status(500).send(JSON.stringify({ error: e.message || String(e) }));
  }
};
