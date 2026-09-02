/**
 * /api/rates — server-side currency proxy
 * ------------------------------------------------------------
 * Deploy target: Vercel serverless function (Node runtime).
 * Called by the app (same-origin, no CORS problem) to refresh:
 *   - jpy      → ATB Bank, "для денежных переводов" tab, продажа (за 1 йену)
 *   - usdtKrw  → Naver search result for "usdt"  (raw value, app applies -5)
 *   - usdtRub  → Investing.com USDT/RUB           (raw value, app applies +3)
 *
 * ЮАНЬ / VTB is intentionally NOT scraped here: vtb.ru's robots.txt
 * disallows automated access, so this proxy does not fetch it. That
 * rate stays quick-link + manual in the app, by design.
 *
 * IMPORTANT — these are HTML scrapes of pages you don't control.
 * Bank and finance sites redesign often and may rate-limit or block
 * server IPs outright. Treat this as best-effort automation, not a
 * guaranteed feed: the app always falls back to manual entry, and
 * you should expect to revisit the regexes below occasionally.
 * Test each extractor after deploying and adjust the patterns to
 * match what the target page actually returns at that time.
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ru-RU,ru;q=0.9' } });
  if (!res.ok) throw new Error('fetch failed: ' + res.status);
  return res.text();
}

// ATB: "для денежных переводов" tab → JPY row → "продажа" value (per 100 JPY)
async function getJpy() {
  const html = await fetchText('https://www.atb.su/services/exchange/');
  // Look for the "для денежных переводов" panel, then the JPY row inside it,
  // then its "продажа" (sell) figure. Adjust this if ATB changes markup.
  const section = html.split(/для\s+денежных\s+переводов/i)[1] || html;
  const jpyBlock = section.split(/JPY/i)[1] || '';
  const m = jpyBlock.match(/продажа[^0-9]{0,40}([\d]+[.,][\d]+)/i);
  if (!m) throw new Error('jpy: pattern not found');
  const per100 = parseFloat(m[1].replace(',', '.'));
  return per100 / 100; // page quotes per 100 JPY, app wants per 1 JPY
}

// Investing.com USDT/RUB page
async function getUsdtRub() {
  const html = await fetchText('https://www.investing.com/crypto/tether/usdt-rub');
  let m = html.match(/"last"\s*:\s*"?([\d]+\.?[\d]*)"?/i);
  if (!m) m = html.match(/data-test="instrument-price-last"[^>]*>([\d.,]+)</i);
  if (!m) throw new Error('usdtRub: pattern not found');
  return parseFloat(m[1].replace(',', ''));
}

// Naver search result widget for "usdt"
async function getUsdtKrw() {
  const url = 'https://search.naver.com/search.naver?where=nexearch&sm=top_sug.pre&fbm=0&acr=1&acq=usdt&qdt=0&ie=utf8&query=usdt&ackey=op24n8r1';
  const html = await fetchText(url);
  const m = html.match(/([\d]{1,3}(?:,\d{3})*)\s*원/);
  if (!m) throw new Error('usdtKrw: pattern not found');
  return parseFloat(m[1].replace(/,/g, ''));
}

module.exports = async (req, res) => {
  const out = { jpy: null, usdtRub: null, usdtKrw: null, timestamp: Date.now(), errors: {} };

  await Promise.all([
    getJpy().then(v => (out.jpy = v)).catch(e => (out.errors.jpy = String(e.message || e))),
    getUsdtRub().then(v => (out.usdtRub = v)).catch(e => (out.errors.usdtRub = String(e.message || e))),
    getUsdtKrw().then(v => (out.usdtKrw = v)).catch(e => (out.errors.usdtKrw = String(e.message || e)))
  ]);

  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).send(JSON.stringify(out));
};
