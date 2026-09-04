/**
 * /api/customs — server-side proxy for import duty + utilisation fee
 * ------------------------------------------------------------
 * Primary source: TKS.RU's own official "Расчёт авто" API
 * (api1.tks.ru/auto.json/json/<ключ>/) — a paid, licensed product this
 * app's account has a key for. Documented at
 * github.com/tkssoft/api.tks.ru-docs/blob/main/AUTO.JSON.md.
 *
 * Getting here took two wrong turns worth recording:
 *   1. tks.ru/auto/calc/ (the public web page) submits through a "cap"
 *      anti-bot widget — automating that would mean bypassing bot
 *      detection, which this app won't do.
 *   2. The general "Расчёт таможенных платежей" API at
 *      calc.tks.ru/calc/<X.509 certificate>/ (api.tks.ru-docs' README.md)
 *      500s even on its own documented example — wrong product for the
 *      key we have. Per that repo's own README: TKS runs *two* API
 *      hosts — api.tks.ru wants a URL-encoded X.509 certificate,
 *      api1.tks.ru wants a plain licence key matching [a-z0-9]{32}.
 *      Our key is exactly that shape, so api1.tks.ru is the right host.
 * AUTO.JSON.md's own example, called live with our key, returned a
 * clean 200 with real numbers — cross-checked against Решение №107
 * (1.7 евро/см3 for 1000–1500см3 · 3–5 лет — exact) and against this
 * same app's independent alta.ru integration for an equivalent case
 * (сбор за оформление 13541 руб for a ~2 000 000 руб car — exact match
 * between two unrelated official calculators).
 *
 * fetchFromTks() is tried first. alta.ru/auto-vat/ (see fetchFromAlta
 * below) is kept as an automatic fallback if TKS errors or times out —
 * cheap insurance, not a sign either is untrusted.
 *
 * Currency: the car's value is passed in its ORIGINAL currency (carValue +
 * carCurrency), not pre-converted to RUB. TKS converts it itself using the
 * same official CBR rate it uses everywhere else in its response (verified:
 * TKS's own valuta_usd.kurs/valuta_euro.kurs match cbr-xml-daily.ru exactly
 * for the same date) — that's the legally correct rate for a customs value.
 * Our own commercial rates (VTB/ATB/Naver, with bank-commission markup) are
 * for client invoicing only and must never be used for the customs value —
 * using them was the root cause of a real duty/НДС mismatch a user found
 * against a manual tks.ru check. The alta.ru fallback still needs a
 * pre-converted RUB price (its form has no currency-conversion of its own),
 * so cbrRateToRub() fetches the same CBR rate for that one case.
 *
 * Input (POST JSON body):
 *   {
 *     ageCode: 'age0'|'age3'|'age5',      // <3 / 3-5 / >5 years (Решение №107 buckets)
 *     carValue: number,                    // customs value in its original currency
 *     carCurrency: 'RUB'|'USD'|'EUR'|'CNY'|'JPY'|'KRW',
 *     volumeCm3: number,
 *     dtype: 'ben'|'dis'|'electric',
 *     hybrid1: '1'|'2'|'3',                 // 1 = not hybrid, 2 = electro-hybrid, 3 = PHEV
 *     hybrid2: 'a'|'b',                     // ДВС>ЭД / ДВС<ЭД, only used if hybrid1 != '1'
 *     power: number, powerUnit: 'ls'|'kvt',
 *     powerElectric: number, powerElectricUnit: 'ls'|'kvt'
 *   }
 *
 * Output: { duty, util, dutyItems, utilBasis, source } or { error }
 *   duty = every payment TKS/alta.ru charge except the utilisation fee
 *   (сбор за оформление + пошлина, and where applicable акциз/НДС) —
 *   summed, so it always equals what the official calculator's own
 *   "Итого" minus утильсбор would show, regardless of which specific
 *   payments apply to a given car.
 */

const TKS_KEY = process.env.TKS_API_KEY; // Vercel env var — see Settings → Environment Variables, never hardcode this here
const ALTA_URL = 'https://www.alta.ru/auto-vat/';
const CBR_URL = 'https://www.cbr-xml-daily.ru/daily_json.js';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function num(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }

// ISO 4217 numeric codes — TKS's "currency" param takes these directly.
const ISO_NUMERIC = { RUB: '643', USD: '840', EUR: '978', CNY: '156', JPY: '392', KRW: '410' };

// Официальный курс ЦБ РФ (тот же источник, которым пользуется сам tks.ru) —
// нужен только для priceRub, который передаётся в alta.ru-резерв.
async function cbrRateToRub(currency) {
  if (!currency || currency === 'RUB') return 1;
  const r = await fetch(CBR_URL);
  if (!r.ok) throw new Error('cbr-xml-daily.ru http ' + r.status);
  const data = await r.json();
  const v = data.Valute && data.Valute[currency];
  if (!v || v.Value == null) throw new Error('cbr-xml-daily.ru: нет курса для ' + currency);
  return num(v.Value) / num(v.Nominal || 1);
}

// ---------------------------------------------------------------------
// TKS.RU — api1.tks.ru/auto.json/json/<key>/  (primary)
// ---------------------------------------------------------------------
const TKS_AGE = { age0: '3', age3: '35', age5: '57' };
function tksEngineType(dtype, hybrid1) {
  const hybrid = hybrid1 && hybrid1 !== '1';
  if (dtype === 'electric') return 'electric';
  if (dtype === 'dis') return hybrid ? 'diesel_electric' : 'diesel';
  return hybrid ? 'petrol_electric' : 'petrol';
}

async function fetchFromTks(p) {
  if (!TKS_KEY) throw new Error('TKS_API_KEY не настроен на сервере');
  const isElectric = p.dtype === 'electric';
  const isHybrid = p.hybrid1 && p.hybrid1 !== '1';

  const qs = new URLSearchParams({
    cost: String(Math.max(0, Math.round(num(p.carValue)))),
    currency: ISO_NUMERIC[p.carCurrency] || '643', // TKS сам конвертирует по курсу ЦБ на сегодня
    volume: String(isElectric ? 0 : Math.max(0, Math.round(p.volumeCm3 || 0))),
    power: String(Math.max(0, Math.round(num(p.power)))),
    power_edizm: p.powerUnit === 'kvt' ? 'kvt' : 'ls',
    engine_type: tksEngineType(p.dtype, p.hybrid1),
    age: TKS_AGE[p.ageCode] || '35',
    face: 'nat', // физическое лицо (ЕТС) — единственный сценарий, который считает это приложение
    ts_type: '00_8703' // легковой автомобиль
  });
  if (isHybrid) {
    qs.set('power_hybrid_dvs', String(Math.max(0, Math.round(num(p.power)))));
    qs.set('power_hybrid_dvs_edizm', p.powerUnit === 'kvt' ? 'kvt' : 'ls');
    qs.set('power_hybrid_electro', String(Math.max(0, Math.round(num(p.powerElectric)))));
    qs.set('power_hybrid_electro_edizm', p.powerElectricUnit === 'ls' ? 'ls' : 'kvt');
    qs.set('sequential', 'false');
  }

  const url = `https://api1.tks.ru/auto.json/json/${TKS_KEY}/?${qs.toString()}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let text;
  try {
    const r = await fetch(url, { signal: controller.signal });
    if (!r.ok) throw new Error('api1.tks.ru http ' + r.status);
    text = await r.text();
  } finally {
    clearTimeout(timeout);
  }

  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error('api1.tks.ru: ответ не в формате JSON'); }

  const sum = data.sum && data.sum.value_rub != null ? num(data.sum.value_rub) : null; // сбор+пошлина(+акциз/НДС, если применимо) — уже без утильсбора
  const util = data.util_sbor && data.util_sbor.value_rub != null ? num(data.util_sbor.value_rub) : null;
  if (sum === null && util === null) throw new Error('api1.tks.ru: не нашли полей sum/util_sbor в ответе — формат мог измениться');

  // Для большинства легковых авто физлица (ЕТС) платят единую ставку по объёму
  // двигателя и в data.sum акциз/НДС не входят — но у электромобилей нет объёма
  // (см3=0), под ЕТС-таблицу они не попадают, и TKS считает их как в общем
  // порядке: пошлина + акциз (по мощности) + НДС — все три входят в data.sum.
  // Поэтому явно проверяем каждое поле и сверяем сумму с data.sum, а не
  // полагаемся на заранее заданный список компонентов.
  const dutyItems = [];
  if (data.tam_oform && data.tam_oform.value_rub != null) dutyItems.push({ label: 'Таможенное оформление', amount: num(data.tam_oform.value_rub) });
  if (data.poshl && data.poshl.value_rub != null) dutyItems.push({ label: 'Пошлина' + (data.poshl.name ? ' (' + data.poshl.name + ')' : ''), amount: num(data.poshl.value_rub) });
  if (data.akciz && data.akciz.value_rub != null) dutyItems.push({ label: 'Акциз' + (data.akciz.name ? ' (' + data.akciz.name + ')' : ''), amount: num(data.akciz.value_rub) });
  if (data.nds && data.nds.value_rub != null) dutyItems.push({ label: 'НДС' + (data.nds.name ? ' (' + data.nds.name + ')' : ''), amount: num(data.nds.value_rub) });
  if (sum !== null) {
    const known = dutyItems.reduce((s, x) => s + x.amount, 0);
    const rest = Math.round((sum - known) * 100) / 100;
    if (Math.abs(rest) >= 1) dutyItems.push({ label: 'Прочее', amount: rest });
  }

  const result = {
    duty: sum,
    util,
    dutyItems,
    utilBasis: data.util_sbor && data.util_sbor.value_base != null
      ? `База ${data.util_sbor.value_base} ₽ × коэф. ${data.util_sbor.value_coef}`
      : null,
    source: 'tks'
  };
  return result;
}

// ---------------------------------------------------------------------
// alta.ru/auto-vat/ (fallback — see file header)
// ---------------------------------------------------------------------
function cellTexts(rowHtml) {
  const cells = [];
  const re = /<td[^>]*>([\s\S]*?)<\/td>/g;
  let m;
  while ((m = re.exec(rowHtml))) cells.push(m[1]);
  return cells;
}
function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&shy;/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
function parseAltaSum(cellHtml) {
  const text = cellHtml.replace(/&nbsp;/g, ' ');
  const m = text.match(/[\d][\d\s ]*(?:[.,]\d{1,2})?/);
  if (!m) return null;
  const cleaned = m[0].replace(/[\s ]/g, '').replace(',', '.');
  const v = parseFloat(cleaned);
  return isNaN(v) ? null : v;
}
function parseAltaResult(html) {
  const rows = html.match(/<tr[\s\S]*?<\/tr>/g) || [];
  let util = null, utilBasis = null;
  const dutyItems = [];
  for (const row of rows) {
    const cells = cellTexts(row);
    if (cells.length < 4) continue;
    const label = stripTags(cells[0]);
    if (!label) continue;
    const sum = parseAltaSum(cells[3]);
    if (sum === null) continue;
    if (/утилиза/i.test(row)) { util = sum; utilBasis = label; }
    else { dutyItems.push({ label, amount: sum }); }
  }
  const duty = dutyItems.length ? dutyItems.reduce((s, x) => s + x.amount, 0) : null;
  return { duty, util, dutyItems, utilBasis };
}

async function fetchFromAlta(p) {
  const isElectric = p.dtype === 'electric';
  const rate = await cbrRateToRub(p.carCurrency);
  const priceRub = num(p.carValue) * rate;
  const params = new URLSearchParams({
    age: p.ageCode,
    price: String(Math.max(0, Math.round(priceRub))),
    currency: '643',
    dtype: p.dtype,
    obyem: String(isElectric ? 0 : Math.max(0, Math.round(p.volumeCm3 || 0))),
    pwr_val: String(p.power || ''),
    pwr: p.powerUnit === 'kvt' ? 'kvt' : 'ls',
    pwr_electric_val: String(p.powerElectric || ''),
    pwr_electric: p.powerElectricUnit === 'ls' ? 'ls' : 'kvt',
    hybrid1: p.hybrid1 || '1',
    hybrid2: p.hybrid2 === 'b' ? 'b' : 'a',
    lico: 'fiz_personal_use'
  });

  const altaRes = await fetch(ALTA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA, 'Accept-Language': 'ru-RU,ru;q=0.9' },
    body: params.toString()
  });
  if (!altaRes.ok) throw new Error('alta.ru http ' + altaRes.status);
  const html = await altaRes.text();
  const startIdx = html.indexOf('Схема расчета');
  if (startIdx === -1) throw new Error('не удалось распознать ответ калькулятора (возможно, изменилась вёрстка alta.ru)');
  const totalIdx = html.indexOf('Итого:', startIdx);
  const resultHtml = html.slice(startIdx, totalIdx === -1 ? startIdx + 6000 : totalIdx + 50);

  const { duty, util, dutyItems, utilBasis } = parseAltaResult(resultHtml);
  if (duty === null && util === null) throw new Error('не нашли ни одной строки платежей в ответе — вёрстка alta.ru могла измениться');
  return { duty, util, dutyItems, utilBasis, source: 'alta' };
}

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

  const { ageCode, dtype, carValue, carCurrency } = body;
  if (!ageCode || !dtype || carValue == null || !carCurrency) {
    res.status(200).send(JSON.stringify({ error: 'не переданы обязательные параметры (возраст/тип двигателя/стоимость/валюта)' }));
    return;
  }

  try {
    const result = await fetchFromTks(body);
    res.status(200).send(JSON.stringify(result));
  } catch (tksErr) {
    try {
      const result = await fetchFromAlta(body);
      res.status(200).send(JSON.stringify({ ...result, tksError: tksErr.message || String(tksErr) }));
    } catch (altaErr) {
      res.status(200).send(JSON.stringify({
        error: 'Не удалось получить расчёт ни от TKS (' + (tksErr.message || tksErr) + '), ни от alta.ru (' + (altaErr.message || altaErr) + ')'
      }));
    }
  }
};
