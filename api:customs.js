/**
 * /api/customs — server-side proxy for automatic import-duty calculation
 * via TKS's official "Расчёт таможенных платежей" API.
 * ------------------------------------------------------------
 * Source of the request/response shape: https://github.com/tkssoft/api.tks.ru
 * (public docs, "Расчет таможенных платежей" section). This is a general
 * customs-declaration calculator keyed by TN VED code — not a car-specific
 * product, and it does not compute the utilisation fee (утилизационный
 * сбор). The app only calls this for cars 3+ years old; cars under 3
 * years use the public ad-valorem+floor formula computed client-side
 * (see fetchCustomsFromTks in index.html), and the utilisation fee always
 * stays manual (alta.ru / tks.ru/auto/calc links in the app).
 *
 * Input (POST JSON body), sent by the app:
 *   { apiKey, tnvedCode, countryCode, valueRub, volumeCm3, hp, rateEurPerCm3 }
 *
 * Output: { duty: number } or { error: string }
 *
 * IMPORTANT — please sanity-check the first few results against
 * alta.ru/auto-vat or tks.ru/auto/calc before relying on this. Two things
 * in particular are unconfirmed and may need adjusting once you can test
 * against the live endpoint with your certificate:
 *   1. Whether the value you shared is the client certificate used in the
 *      URL path (https://calc.tks.ru/calc/<certificate>/) or a "product
 *      id" for a different, pre-configured calculator (my.tks.ru has
 *      both concepts). This code assumes it's the certificate.
 *   2. The exact field IDs (G32, G45, IMP, etc.) are documented for
 *      general customs declarations, not specifically vehicles — I've
 *      mapped duty/currency/value fields as directly as the docs allow,
 *      but there's no worked car example in the docs to double check
 *      against.
 * If a result looks off, the safest fix is telling me what number
 * tks.ru/auto/calc or alta.ru gives for the same car so I can compare
 * and correct the mapping here.
 */

const CURRENCY_RUB = '643';

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

  const { apiKey, tnvedCode, countryCode, valueRub, volumeCm3, hp, rateEurPerCm3 } = body;

  if (!apiKey) {
    res.status(200).send(JSON.stringify({ error: 'ТКС API не настроен — добавьте ключ (сертификат) в Настройках' }));
    return;
  }

  const today = new Date().toISOString().slice(0, 10);

  const payload = {
    kontrakt: { NUM: 1, G221: CURRENCY_RUB, G542: today },
    kontdop: [{
      NUM: 1,
      G32: 1,
      G33: tnvedCode,
      G34: countryCode,
      G45: valueRub,
      G45V: CURRENCY_RUB,
      GEDI3: hp || null,        // мощность
      GEDI2: volumeCm3 || null, // физический объём (см³)
      IMP: rateEurPerCm3,       // ставка пошлины — €/см³, определена нами по Решению ЕЭК №107
      IMPEDI: '3'                // единица ставки — "специфическая" (не % от стоимости)
    }]
  };

  try {
    const tksRes = await fetch(`https://calc.tks.ru/calc/${encodeURIComponent(apiKey)}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!tksRes.ok) {
      res.status(200).send(JSON.stringify({ error: 'ТКС API ответил ' + tksRes.status + ' — см. комментарий в api/customs.js, возможно нужно поправить сертификат/эндпоинт' }));
      return;
    }
    const data = await tksRes.json();
    const duty = data && data.totals && typeof data.totals.sum === 'number' ? data.totals.sum : null;
    if (duty === null) {
      res.status(200).send(JSON.stringify({ error: 'ТКС ответил, но без ожидаемого поля totals.sum — формат ответа отличается от документации, пришлите пример для сверки', raw: data }));
      return;
    }
    res.status(200).send(JSON.stringify({ duty }));
  } catch (e) {
    res.status(200).send(JSON.stringify({ error: 'Не удалось обратиться к ТКС API: ' + (e.message || e) }));
  }
};
