/**
 * /api/rates — server-side currency proxy
 * ------------------------------------------------------------
 * Deploy target: Vercel serverless function (Node runtime).
 * Called by the app (same-origin, no CORS problem) to refresh:
 *   - jpy      → ATB Bank, "для денежных переводов" tab, продажа (за 1 йену)
 *   - usdtKrw  → Naver search result for "usdt"  (raw value, app applies -5)
 *
 * ЮАНЬ / VTB is intentionally NOT scraped here: vtb.ru's robots.txt
 * disallows automated access, so this proxy does not fetch it. That
 * rate stays quick-link + manual in the app, by design.
 *
 * USDT/₽ is also NOT scraped here any more — investing.com returns a
 * flat 403 from Vercel's server IPs (Cloudflare bot detection), so the
 * app instead computes it client-side straight from the same official
 * ЦБ РФ feed EUR already uses (курс USD + 3), which is both more
 * reliable and one fewer thing that can silently go stale — see
 * CONFIG.rates.USDT_RUB in index.html.
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

// ATB: currency page has 4 tabs (в отделениях/для карт/ЦБ РФ/для денежных
// переводов) rendered as sibling <div id="currencyTabN"> blocks, all present
// in the raw HTML (tab switching is client-side CSS/JS, not a separate
// request) — так что нужно взять именно блок currencyTab4 ("для денежных
// переводов"), а не первый попавшийся "JPY" в документе (он в другом табе).
async function getJpy() {
  const html = await fetchText('https://www.atb.su/services/exchange/');
  const tabRe = /id="currencyTab4">\s*<div class="currency-table"/;
  const m0 = tabRe.exec(html);
  if (!m0) throw new Error('jpy: "для денежных переводов" section not found');
  const blockStart = m0.index;
  const nextTab = html.indexOf('currency-tabs__item', blockStart + 50);
  const block = html.slice(blockStart, nextTab === -1 ? blockStart + 6000 : nextTab);
  const jpyIdx = block.indexOf('>JPY<');
  if (jpyIdx === -1) throw new Error('jpy: JPY row not found');
  const after = block.slice(jpyIdx, jpyIdx + 900);
  const m = after.match(/продажа<\/div>\s*([\d]+[.,][\d]+)/i);
  if (!m) throw new Error('jpy: rate not found');
  const per100 = parseFloat(m[1].replace(',', '.'));
  return per100 / 100; // page quotes per 100 JPY, app wants per 1 JPY
}

// Naver search result widget for "usdt"
async function getUsdtKrw() {
  const url = 'https://search.naver.com/search.naver?where=nexearch&sm=top_sug.pre&fbm=0&acr=1&acq=usdt&qdt=0&ie=utf8&query=usdt&ackey=op24n8r1';
  const html = await fetchText(url);
  const m = html.match(/([\d]{1,3}(?:,\d{3})*)\s*원/);
  if (!m) throw new Error('usdtKrw: pattern not found; got: ' + JSON.stringify(html.slice(0, 400)));
  return parseFloat(m[1].replace(/,/g, ''));
}

module.exports = async (req, res) => {
  const out = { jpy: null, usdtKrw: null, timestamp: Date.now(), errors: {} };

  await Promise.all([
    getJpy().then(v => (out.jpy = v)).catch(e => (out.errors.jpy = String(e.message || e))),
    getUsdtKrw().then(v => (out.usdtKrw = v)).catch(e => (out.errors.usdtKrw = String(e.message || e)))
  ]);

  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).send(JSON.stringify(out));
};
