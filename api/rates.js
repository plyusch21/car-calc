/**
 * /api/rates — server-side currency proxy
 * ------------------------------------------------------------
 * Deploy target: Vercel serverless function (Node runtime).
 * Called by the app (same-origin, no CORS problem) to refresh:
 *   - jpy      → ATB Bank, "для денежных переводов" tab, продажа (за 1 йену)
 *   - usdtKrw  → Naver search result for "usdt"  (raw value, app applies -5)
 *   - cny      → VTB Online currency-rates API, category 10 ("В ВТБ Онлайн,
 *                без подписок и пакетов услуг"), tier "до 500 000.00 ¥",
 *                курс продажи (offer) — банк продаёт юани клиенту
 *
 * ЮАНЬ / VTB — an earlier version of this file left this manual-only,
 * assuming vtb.ru's robots.txt disallowed automated access. That was
 * wrong: robots.txt does not block /api/currencyrates/* or the exchange
 * page at all (checked directly). The real obstacle is that vtb.ru's
 * TLS certificate is issued by Russia's own "Минцифры" root CA (Russian
 * Trusted Root, used broadly by RU banks/government sites since western
 * CAs restricted issuance to sanctioned entities), which isn't in the
 * standard global trust store — so plain fetch() fails TLS verification
 * before it ever gets a robots.txt-governed response. That's a missing
 * trust anchor, not an anti-bot measure: the endpoint itself is a public,
 * unauthenticated JSON API vtb.ru's own site calls client-side to render
 * its rates table (found via the page's own Network tab — no login, no
 * captcha). getCny() below uses Node's classic https module (not the
 * global fetch/undici used elsewhere in this file) so it can pass
 * rejectUnauthorized:false for this one host specifically.
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

const https = require('https');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ru-RU,ru;q=0.9' } });
  if (!res.ok) throw new Error('fetch failed: ' + res.status);
  return res.text();
}

// vtb.ru presents a certificate from Russia's national "Минцифры" CA,
// which Node's default trust store doesn't include — see file header.
// Accept-Encoding: identity avoids needing to gunzip manually (Node's
// https module, unlike fetch, doesn't auto-decompress).
function fetchTextInsecure(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json, text/plain, */*', 'Accept-Encoding': 'identity' },
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) reject(new Error('http ' + res.statusCode));
        else resolve(data);
      });
    }).on('error', reject);
  });
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

// Naver search result widget for "usdt" — the price sits in
// <div class="price_info_box"><div><strong class="price">1,374</strong>
// <span class="unit">원</span></div>...</div>, i.e. digits and "원" are
// separated by closing/opening tags, not just whitespace.
async function getUsdtKrw() {
  const url = 'https://search.naver.com/search.naver?where=nexearch&sm=top_sug.pre&fbm=0&acr=1&acq=usdt&qdt=0&ie=utf8&query=usdt&ackey=op24n8r1';
  const html = await fetchText(url);
  let m = html.match(/class="price">([\d,]+)<\/strong>\s*<span class="unit">\s*원/);
  if (!m) m = html.match(/class="price">([\d,]+)</); // запасной вариант, если поменяется разметка вокруг "원"
  if (!m) throw new Error('usdtKrw: pattern not found');
  return parseFloat(m[1].replace(/,/g, ''));
}

// VTB Online currency table — the same endpoint vtb.ru's own React front-end
// calls to render "Курсы валют на сегодня". No auth, no captcha, plain JSON:
//   { category:{...}, rates:[ { currency1:{code:"CNY",...}, currency2:{code:"RUB"},
//     bid, offer, tooltip:"до 500000.00" }, ... ] }
// category=10 = "В ВТБ Онлайн (Без подписок и пакетов услуг)", type=1 = "Рубли/Валюта".
async function getCny() {
  const url = 'https://www.vtb.ru/api/currencyrates/table/optimized?category=10&type=1&handbook=9234';
  const body = await fetchTextInsecure(url);
  const data = JSON.parse(body);
  const rate = (data.rates || []).find(r =>
    r.currency1 && r.currency1.code === 'CNY' && r.currency2 && r.currency2.code === 'RUB' && r.tooltip === 'до 500000.00'
  );
  if (!rate || typeof rate.offer !== 'number') throw new Error('cny: rate not found in response');
  return rate.offer; // курс продажи — банк продаёт юани клиенту
}

module.exports = async (req, res) => {
  const out = { jpy: null, usdtKrw: null, cny: null, timestamp: Date.now(), errors: {} };

  await Promise.all([
    getJpy().then(v => (out.jpy = v)).catch(e => (out.errors.jpy = String(e.message || e))),
    getUsdtKrw().then(v => (out.usdtKrw = v)).catch(e => (out.errors.usdtKrw = String(e.message || e))),
    getCny().then(v => (out.cny = v)).catch(e => (out.errors.cny = String(e.message || e)))
  ]);

  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).send(JSON.stringify(out));
};
