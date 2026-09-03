/**
 * /api/customs — server-side proxy for import duty + utilisation fee
 * ------------------------------------------------------------
 * Why this calls alta.ru, not tks.ru directly:
 * tks.ru/auto/calc/ (the site the app is meant to match) submits its
 * calculator form through a "cap" anti-bot widget (cap-token field) —
 * automating that submission would mean solving/bypassing a bot-detection
 * challenge, which this app will not do. There is also a separate paid
 * "Расчёт авто" API product from TKS.RU, but TKS did not provide request/
 * response documentation for it, so calling it would mean guessing an
 * undocumented commercial API's contract — too high a risk of silently
 * wrong numbers for a tool that has to match an official calculator
 * exactly.
 *
 * alta.ru/auto-vat/ is a free, public, non-captcha calculator that computes
 * duty and utilisation fee from the *same* legal sources tks.ru itself
 * cites (Решение Совета ЕЭК №107 от 20.12.2017, Постановление Правительства
 * РФ №1291 от 26.12.2013 с изменениями). Submitting its plain HTML form
 * (no captcha, no token) and reading the numbers back off the rendered
 * result table gives an always-current, exact match to an official
 * calculator — verified live spot-checks (03.09.2026) against duty rates
 * confirm this matches Решение №107 precisely (e.g. 2300–3000 см3 · 3–5 лет
 * → 3.0 евро/см3, >5 лет → 5.0 евро/см3, <3 лет → 48% но не менее ставки за
 * см3 по вилке таможенной стоимости в EUR — exactly the public rate table).
 *
 * IMPORTANT: the utilisation fee for individuals is NOT the flat 3400/5200
 * руб figure that was true for years — a 2024+ reform made it depend on
 * engine volume AND power brackets too, and those brackets can change again
 * by government decree. That is exactly why this proxies live instead of
 * hard-coding a table: whatever alta.ru currently returns is what gets
 * shown, so there is nothing here to go stale.
 *
 * Input (POST JSON body):
 *   {
 *     ageCode: 'age0'|'age3'|'age5',      // <3 / 3-5 / >5 years (Решение №107 buckets)
 *     priceRub: number,                    // customs value already converted to RUB
 *     volumeCm3: number,
 *     dtype: 'ben'|'dis'|'electric',
 *     hybrid1: '1'|'2'|'3',                 // 1 = not hybrid, 2 = electro-hybrid, 3 = PHEV
 *     hybrid2: 'a'|'b',                     // ДВС>ЭД / ДВС<ЭД, only used if hybrid1 != '1'
 *     power: number, powerUnit: 'ls'|'kvt',
 *     powerElectric: number, powerElectricUnit: 'ls'|'kvt',
 *     jeep: boolean                         // "повышенной проходимости"
 *   }
 *
 * Output: { duty, util, fee, dutyBasis, utilBasis } or { error }
 *   fee = сбор за таможенное оформление (Постановление №1637), tiered by
 *   declared value — small, but it's part of the same "таможенные платежи"
 *   bucket as duty+util in the reference cost sheet this app matches.
 */

const ALTA_URL = 'https://www.alta.ru/auto-vat/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

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
function parseSum(cellHtml) {
  const digits = cellHtml.replace(/&nbsp;/g, ' ').replace(/[^\d.,]/g, '').replace(/,/g, '.');
  // last dot is the decimal separator, earlier dots (if any) are junk from stripping
  const parts = digits.split('.');
  const num = parts.length > 1 ? parts.slice(0, -1).join('') + '.' + parts[parts.length - 1] : digits;
  const v = parseFloat(num);
  return isNaN(v) ? null : v;
}

function parseResult(html) {
  const rows = html.match(/<tr[\s\S]*?<\/tr>/g) || [];
  let duty = null, util = null, fee = null, dutyBasis = null, utilBasis = null;
  for (const row of rows) {
    if (!/пошлина/i.test(row) && !/утилиза/i.test(row) && !/таможенный сбор/i.test(row)) continue;
    const cells = cellTexts(row);
    if (cells.length < 4) continue;
    const sum = parseSum(cells[3]);
    if (/пошлина/i.test(cells[0])) { duty = sum; dutyBasis = stripTags(cells[2]); }
    else if (/утилиза/i.test(row)) { util = sum; utilBasis = stripTags(cells[0]); }
    else if (/таможенный сбор/i.test(cells[0])) { fee = sum; }
  }
  return { duty, util, fee, dutyBasis, utilBasis };
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

  const {
    ageCode, priceRub, volumeCm3, dtype,
    hybrid1, hybrid2, power, powerUnit, powerElectric, powerElectricUnit, jeep
  } = body;

  if (!ageCode || !dtype) {
    res.status(200).send(JSON.stringify({ error: 'не переданы обязательные параметры (возраст/тип двигателя)' }));
    return;
  }

  const params = new URLSearchParams({
    age: ageCode,
    price: String(Math.max(0, Math.round(priceRub || 0))),
    currency: '643', // RUB — we always pass our own already-converted rouble value
    dtype,
    obyem: String(Math.max(0, Math.round(volumeCm3 || 0))),
    pwr_val: String(power || ''),
    pwr: powerUnit === 'kvt' ? 'kvt' : 'ls',
    pwr_electric_val: String(powerElectric || ''),
    pwr_electric: powerElectricUnit === 'ls' ? 'ls' : 'kvt',
    hybrid1: hybrid1 || '1',
    hybrid2: hybrid2 === 'b' ? 'b' : 'a',
    lico: 'fiz_personal_use'
  });
  if (jeep) params.set('jeep', 'on');

  try {
    const altaRes = await fetch(ALTA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': UA,
        'Accept-Language': 'ru-RU,ru;q=0.9'
      },
      body: params.toString()
    });
    if (!altaRes.ok) throw new Error('alta.ru http ' + altaRes.status);
    const html = await altaRes.text();
    const startIdx = html.indexOf('Схема расчета');
    if (startIdx === -1) throw new Error('не удалось распознать ответ калькулятора (возможно, изменилась вёрстка alta.ru)');
    const totalIdx = html.indexOf('Итого:', startIdx);
    const resultHtml = html.slice(startIdx, totalIdx === -1 ? startIdx + 6000 : totalIdx + 50);

    const { duty, util, fee, dutyBasis, utilBasis } = parseResult(resultHtml);
    if (duty === null && util === null) throw new Error('не нашли строки "Пошлина"/"Утилизационный сбор" в ответе — вёрстка alta.ru могла измениться');

    res.status(200).send(JSON.stringify({ duty, util, fee, dutyBasis, utilBasis }));
  } catch (e) {
    res.status(200).send(JSON.stringify({ error: 'Не удалось получить расчёт с alta.ru: ' + (e.message || e) }));
  }
};
