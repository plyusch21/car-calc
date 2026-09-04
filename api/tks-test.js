/**
 * TEMPORARY diagnostic endpoint — checks whether calc.tks.ru is reachable
 * from Vercel's network at all, and if so, what it returns for a
 * documented-format request. Delete once the real integration question
 * is resolved either way.
 *
 * Docs used: https://github.com/tkssoft/api.tks.ru (README.md,
 * "Расчет таможенных платежей" section) — the request/response shape
 * below matches that documentation exactly.
 */

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const apiKey = '87434b095e3f4d6fa8febccee738b9bf';
  const payload = {
    kontrakt: { NUM: 1, G221: '643', G542: new Date().toISOString().slice(0, 10) },
    kontdop: [{
      NUM: 1, G32: 1, G33: '8703239024', G34: '156',
      G45: 2000000.0, G45V: '643',
      GEDI2: 2494.0, GEDI3: null,
      IMP: 3.0, IMPEDI: '1'
    }]
  };

  const started = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    const tksRes = await fetch(`https://calc.tks.ru/calc/${apiKey}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeout);
    const text = await tksRes.text();
    res.status(200).send(JSON.stringify({
      reachable: true,
      ms: Date.now() - started,
      httpStatus: tksRes.status,
      bodyPreview: text.slice(0, 3000)
    }));
  } catch (e) {
    res.status(200).send(JSON.stringify({
      reachable: false,
      ms: Date.now() - started,
      error: e.name + ': ' + (e.message || String(e))
    }));
  }
};
