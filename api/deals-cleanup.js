/**
 * /api/deals-cleanup — ежедневный сторож архива сделок.
 *
 * Удалённые (свайп → «Удалить», не настоящее завершение — см. action
 * 'removeDeal' в api/deals.js) сделки хранятся в архиве не вечно, а
 * RETENTION_DAYS дней — после этого стираются насовсем: сама запись,
 * лог изменений, строка в индексе. Завершённые по последнему этапу
 * сделки («Выдан авто», deal.removed === false) эта функция не трогает
 * никогда, сколько бы времени ни прошло — это настоящие деловые записи,
 * а не мусор.
 *
 * Запускается по расписанию Vercel Cron (см. vercel.json — раз в сутки,
 * как /api/rates-refresh: более частый график на Hobby-плане однажды
 * сломал весь роутинг к эндпоинту, см. комментарий в rates-refresh.js).
 */

const { kv } = require('./_lib/kv');

const RETENTION_DAYS = 50;

async function readHash(key) {
  const raw = await kv('HGETALL', key);
  const out = [];
  for (let i = 0; i < (raw || []).length; i += 2) {
    try { out.push({ id: raw[i], row: JSON.parse(raw[i + 1]) }); } catch (e) { /* битая запись индекса — пропускаем */ }
  }
  return out;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let purged = 0;
  const errors = [];

  try {
    const idx = await readHash('deals:idx');
    for (const { id, row } of idx) {
      if (!row.removed) continue; // не удалена (в работе или завершена) — не трогаем
      let removedAt = null;
      try {
        const raw = await kv('GET', 'deal:' + id);
        if (raw) removedAt = JSON.parse(raw).removedAt || null;
      } catch (e) {
        console.error('api/deals-cleanup: read deal:' + id + ' failed:', e);
        continue;
      }
      // Нет метки времени удаления (старая запись до этого поля) — не
      // трогаем: лучше ничего не стереть по ошибке, чем стереть лишнее.
      if (!removedAt || removedAt > cutoff) continue;
      try {
        await kv('DEL', 'deal:' + id);
        await kv('DEL', 'deal:' + id + ':log');
        await kv('HDEL', 'deals:idx', id);
        purged++;
      } catch (e) {
        console.error('api/deals-cleanup: purge deal:' + id + ' failed:', e);
        errors.push(id + ': ' + (e.message || e));
      }
    }
    res.status(200).send(JSON.stringify({ ok: true, purged, errors, checkedAt: new Date().toISOString() }));
  } catch (e) {
    console.error('api/deals-cleanup error:', e);
    res.status(500).send(JSON.stringify({ error: e.message || String(e) }));
  }
};
