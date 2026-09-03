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
 *     powerElectric: number, powerElectricUnit: 'ls'|'kvt'
 *   }
 *
 * Output: { duty, util, dutyItems, utilBasis } or { error }
 *   The results table on alta.ru is not always the same 2-3 rows — which
 *   rows appear depends on the inputs. A plain petrol/diesel car for an
 *   individual gets "Таможенный сбор" + "Пошлина"; an electric car under
 *   the same "физлицо для личного пользования" mode additionally gets
 *   "Акциз" and "НДС" rows (Решение №107's flat per-cm³ duty only applies
 *   to combustion-engine cars — electric/other cases fall back to the
 *   general ad-valorem scheme with excise + VAT). Rather than whitelist
 *   row labels and risk silently dropping a row we haven't seen yet,
 *   parseResult() sums every row in the table except the utilisation-fee
 *   one into `duty` — so whatever alta.ru charges under "Таможенные
 *   платежи" for the given inputs, the total always matches exactly.
 *   dutyItems carries the individual {label, amount} rows that made up
 *   that sum, for the "Получено с alta.ru" breakdown shown in the app.
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
  // Numbers are formatted like "267 736.68 руб." — space-grouped thousands,
  // dot/comma decimal, followed by a unit abbreviation that itself ends in
  // a period ("руб."). Match the number by its own shape (digits/spaces,
  // then exactly the decimal point) instead of stripping-then-guessing —
  // guessing "last dot = decimal" broke on "руб." adding a second dot.
  const text = cellHtml.replace(/&nbsp;/g, ' ');
  const m = text.match(/[\d][\d\s ]*(?:[.,]\d{1,2})?/);
  if (!m) return null;
  const cleaned = m[0].replace(/[\s ]/g, '').replace(',', '.');
  const v = parseFloat(cleaned);
  return isNaN(v) ? null : v;
}

function parseResult(html) {
  const rows = html.match(/<tr[\s\S]*?<\/tr>/g) || [];
  let util = null, utilBasis = null;
  const dutyItems = [];
  for (const row of rows) {
    const cells = cellTexts(row);
    if (cells.length < 4) continue; // parameter-echo rows (2 cells) and "Итого" (colspan, 2 cells) are always skipped
    const label = stripTags(cells[0]);
    if (!label) continue;
    const sum = parseSum(cells[3]);
    if (sum === null) continue;
    if (/утилиза/i.test(row)) { util = sum; utilBasis = label; }
    else { dutyItems.push({ label, amount: sum }); }
  }
  const duty = dutyItems.length ? dutyItems.reduce((s, x) => s + x.amount, 0) : null;
  return { duty, util, dutyItems, utilBasis };
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
    hybrid1, hybrid2, power, powerUnit, powerElectric, powerElectricUnit
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
    // NB: no "jeep" (повышенной проходимости) param — alta.ru silently
    // fails to render a result at all when it's set (returns the blank
    // form, no error), so it's left out rather than risk a calc that
    // always degrades to manual entry for SUV/off-road bodies.
  });

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

    const { duty, util, dutyItems, utilBasis } = parseResult(resultHtml);
    if (duty === null && util === null) throw new Error('не нашли ни одной строки платежей в ответе — вёрстка alta.ru могла измениться');

    res.status(200).send(JSON.stringify({ duty, util, dutyItems, utilBasis }));
  } catch (e) {
    res.status(200).send(JSON.stringify({ error: 'Не удалось получить расчёт с alta.ru: ' + (e.message || e) }));
  }
};
