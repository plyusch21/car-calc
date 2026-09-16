/**
 * /api/deals-cleanup — ежедневный уборщик остатков прежнего «мягкого»
 * удаления сделок.
 *
 * Сейчас удаление сделки безвозвратное и мгновенное (см. action
 * 'removeDeal' в api/deals.js): запись, лог и строка индекса стираются
 * сразу, в архиве остаются только успешно завершённые сделки. Но в базе
 * могли остаться записи с deal.removed === true, помеченные по старым
 * правилам, — приложение их уже не показывает (bootstrap их отфильтровывает),
 * и эта функция добивает их физически. Завершённые сделки не трогает
 * никогда — это настоящие деловые записи, а не мусор.
 *
 * Запускается по расписанию Vercel Cron (см. vercel.json — раз в сутки,
 * как /api/rates-refresh: более частый график на Hobby-плане однажды
 * сломал весь роутинг к эндпоинту, см. комментарий в rates-refresh.js).
 */

const { kv } = require('./_lib/kv');

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
  let purged = 0;
  const errors = [];

  try {
    const idx = await readHash('deals:idx');
    for (const { id, row } of idx) {
      if (!row.removed) continue; // в работе или завершена — не трогаем
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
