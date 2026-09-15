/**
 * /api/rates-refresh — ежедневный сторож курсов (ЗАДАНИЕ.md Блок 8).
 *
 * Запускается по расписанию Vercel Cron (см. vercel.json — 0:00 и 12:00 МСК)
 * и НЕ требует вызова из приложения. Задача — не дать разбору курсов молча
 * деградировать: сайты-источники (ATB/Naver/VTB) время от времени меняют
 * вёрстку, а до сих пор единственный признак поломки — красная строка в
 * настройках, куда владелец заходит редко. Этот эндпоинт:
 *   1. обновляет курсы тем же кодом, что и /api/rates (api/rates.js — общие
 *      getJpy/getUsdtKrw/getCny, не отдельная копия);
 *   2. проверяет каждое успешное значение (коридор правдоподобия, скачок
 *      >15% от прошлой записи в истории, застой 3 дня подряд — используя
 *      rates:hist:<ID>, к которой у него прямой доступ, в отличие от
 *      клиента);
 *   3. сверяет с независимым курсом ЦБ РФ (для JPY/CNY — тот всегда
 *      доступен и никак не связан с разбором HTML) и, если разница
 *      подозрительно большая, тоже считает это поводом насторожиться;
 *   4. на успешной, прошедшей все проверки записи — логирует её в rates:hist
 *      (ту же историю, что видят из приложения — см. api/_lib/rateHistory.js);
 *   5. при любой проблеме — шлёт владельцу сообщение в Telegram через Bot
 *      API (тот же TELEGRAM_BOT_TOKEN, что уже используется для проверки
 *      подписи initData в api/_lib/telegram.js).
 *
 * НЕ трогает state:config — тот обновляется как и раньше, когда кто-то
 * открывает приложение (fetchAutoRates в index.html). Работа этого
 * эндпоинта — не подменять собой обычное обновление, а быть сторожем,
 * который замечает проблему даже в дни, когда приложение никто не открывал.
 */

const { kv } = require('./_lib/kv');
const ratesHandler = require('./rates');
const { logRate, getRateHistory } = require('./_lib/rateHistory');

// Коридоры — те же, что и на клиенте (index.html, RATE_CORRIDORS) и по той
// же причине не вынесены в общий модуль: клиент и сервер в этом проекте
// сознательно не делят код (см. CLAUDE.md — один файл на клиент). Если
// меняете тут — поправьте и там.
const RATE_CORRIDORS = { JPY: [0.3, 0.9], CNY: [8, 20], KRW_USDT: [1000, 2000], USDT_RUB: [50, 200] };
const SPIKE_PCT = 15;
const STAGNATION_DAYS = 3;
const CBR_DIVERGENCE_PCT = 25; // расхождение с ЦБ больше этого — уже не обычная банковская наценка

// Те же корректировки, что в DEFAULT_CONFIG.rates (index.html) — курс,
// который реально показывается и используется в приложении, а не только
// то, что вернул сам источник.
const ADJUSTMENTS = { JPY: 0, CNY: 0, KRW_USDT: -5, USDT_RUB: 3 };

function num(v) { const n = parseFloat(v); return isNaN(n) ? null : n; }

async function fetchCbr() {
  const res = await fetch('https://www.cbr-xml-daily.ru/daily_json.js');
  if (!res.ok) throw new Error('cbr-xml-daily.ru http ' + res.status);
  const data = await res.json();
  const v = data.Valute || {};
  const per1 = (code) => (v[code] && v[code].Value != null) ? v[code].Value / (v[code].Nominal || 1) : null;
  return { USD: per1('USD'), CNY: per1('CNY'), JPY: per1('JPY') };
}

// Застой: последние STAGNATION_DAYS дней подряд одно и то же значение —
// почти наверняка разбор сломан и молча отдаёт старое. Смотрим по истории,
// а не по одной свежей записи, — этим сторож и отличается от проверок на
// клиенте (Блок 8, index.html), у которых истории под рукой нет.
function isStagnant(history, newValue) {
  const cutoff = Date.now() - STAGNATION_DAYS * 24 * 60 * 60 * 1000;
  const recent = history.filter((h) => h.at >= cutoff);
  if (recent.length < 2) return false; // мало данных за период — рано делать вывод
  return recent.every((h) => h.value === newValue) && recent[recent.length - 1].at <= cutoff + 12 * 60 * 60 * 1000;
}

async function sendTelegramAlert(text) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return; // некому и некуда слать — не валим весь эндпоинт из-за этого
  const allRaw = await kv('HGETALL', 'access'); // [uid, json, uid, json, ...]
  if (!allRaw || !allRaw.length) return;
  let ownerUid = null;
  for (let i = 0; i < allRaw.length; i += 2) {
    try { if (JSON.parse(allRaw[i + 1]).isOwner) { ownerUid = allRaw[i]; break; } } catch (e) { /* skip */ }
  }
  if (!ownerUid) return;
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: ownerUid, text, parse_mode: 'HTML' })
  }).catch(() => {}); // сторож не должен падать из-за самого уведомления
}

async function checkOne(id, rawValue, cbrValue) {
  const problems = [];
  const corridor = RATE_CORRIDORS[id];
  if (corridor && (rawValue < corridor[0] || rawValue > corridor[1])) {
    problems.push(`вне коридора правдоподобия (${corridor[0]}–${corridor[1]}): получено ${rawValue}`);
  }

  const history = await getRateHistory(id);
  const last = history[0]; // getRateHistory уже отдаёт свежие сначала
  if (last && last.raw > 0) {
    const diffPct = Math.abs(rawValue - last.raw) / last.raw * 100;
    if (diffPct > SPIKE_PCT) problems.push(`скачок больше 15% (было ${last.raw}, стало ${rawValue})`);
  }

  const value = rawValue + (ADJUSTMENTS[id] || 0);
  if (isStagnant(history, value)) {
    problems.push(`значение не менялось ${STAGNATION_DAYS} дня подряд — похоже, разбор сломан и отдаёт старое`);
  }

  if (cbrValue != null && cbrValue > 0) {
    const diffPct = Math.abs(rawValue - cbrValue) / cbrValue * 100;
    if (diffPct > CBR_DIVERGENCE_PCT) {
      problems.push(`расходится с курсом ЦБ больше чем на ${CBR_DIVERGENCE_PCT}% (у нас ${rawValue}, ЦБ ${cbrValue.toFixed(4)})`);
    }
  }

  if (!problems.length) {
    await logRate(id, { raw: rawValue, value, source: 'cron' });
  }
  return problems;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const report = {};
  const alerts = [];

  let cbr = null;
  try { cbr = await fetchCbr(); } catch (e) { console.error('api/rates-refresh: fetchCbr failed:', e); alerts.push('Курс ЦБ РФ недоступен для сверки: ' + (e.message || e)); }

  const fetchers = {
    JPY: () => ratesHandler.getJpy(),
    CNY: () => ratesHandler.getCny(),
    KRW_USDT: () => ratesHandler.getUsdtKrw()
  };
  const cbrFor = { JPY: cbr && cbr.JPY, CNY: cbr && cbr.CNY, KRW_USDT: null };

  for (const id of Object.keys(fetchers)) {
    try {
      const raw = await fetchers[id]();
      const problems = await checkOne(id, raw, cbrFor[id]);
      report[id] = { raw, ok: !problems.length, problems };
      if (problems.length) alerts.push(`<b>${id}</b>: ` + problems.join('; '));
    } catch (e) {
      console.error('api/rates-refresh: ' + id + ' failed:', e);
      report[id] = { ok: false, error: e.message || String(e) };
      alerts.push(`<b>${id}</b>: не удалось обновить — ${e.message || e}`);
    }
  }

  // USDT_RUB — курс ЦБ РФ по USD, плюс корректировка (не HTML-разбор, но та
  // же дисциплина проверок — источник хоть и надёжный, но не застрахован от
  // собственных сбоев/пустых полей).
  if (cbr && cbr.USD != null) {
    try {
      const problems = await checkOne('USDT_RUB', cbr.USD, null);
      report.USDT_RUB = { raw: cbr.USD, ok: !problems.length, problems };
      if (problems.length) alerts.push('<b>USDT_RUB</b>: ' + problems.join('; '));
    } catch (e) {
      console.error('api/rates-refresh: USDT_RUB failed:', e);
      report.USDT_RUB = { ok: false, error: e.message || String(e) };
    }
  } else {
    report.USDT_RUB = { ok: false, error: 'курс USD ЦБ РФ недоступен' };
    alerts.push('<b>USDT_RUB</b>: курс USD ЦБ РФ недоступен');
  }

  if (alerts.length) {
    await sendTelegramAlert('⚠️ Проверка курсов (car-calc)\n\n' + alerts.join('\n'));
  }

  res.status(200).send(JSON.stringify({ ok: true, checkedAt: new Date().toISOString(), report }));
};
