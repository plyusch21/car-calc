/**
 * Курс-история (ЗАДАНИЕ.md Блок 8): каждое успешное обновление курса —
 * отдельная запись, 3 месяца хранения, отдельный ключ KV на каждую валюту
 * (rates:hist:<ID>) — НЕ внутри state:config, который и так общий и тяжёлый.
 *
 * Redis sorted set: score = время (мс), member = JSON-запись. Время как score
 * даёт дешёвую чистку старого без чтения+перезаписи всего списка
 * (ZREMRANGEBYSCORE), в отличие от LIST.
 */

const { kv } = require('./kv');

const RETENTION_MS = 90 * 24 * 60 * 60 * 1000; // 3 месяца

async function logRate(id, entry) {
  const key = 'rates:hist:' + id;
  const at = entry.at || Date.now();
  await kv('ZADD', key, String(at), JSON.stringify({ ...entry, at }));
  await kv('ZREMRANGEBYSCORE', key, '-inf', String(Date.now() - RETENTION_MS));
}

// Восходящий порядок по времени из Redis, разворачиваем в JS — избегаем
// версионных нюансов флага REV у ZRANGE на разных сборках Redis-совместимых
// хранилищ (Upstash и т.п.), а записей тут всё равно немного (максимум пара
// сотен за 3 месяца при обновлении на каждый вход + дважды в сутки по крону).
async function getRateHistory(id, limit) {
  const key = 'rates:hist:' + id;
  const raw = await kv('ZRANGE', key, '0', '-1');
  const entries = (raw || []).map((s) => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean);
  entries.reverse();
  return limit ? entries.slice(0, limit) : entries;
}

module.exports = { logRate, getRateHistory };
