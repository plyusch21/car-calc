/**
 * TEMPORARY diagnostic — testing api1.tks.ru/auto.json/json/<license_key>/
 * per github.com/tkssoft/api.tks.ru-docs/blob/main/AUTO.JSON.md (a
 * different product from calc.tks.ru — that one wants an X.509
 * certificate; this one wants a 32-char [a-z0-9] license key, which is
 * exactly the format of the key we have). Delete once resolved.
 */

const KEY = '87434b095e3f4d6fa8febccee738b9bf';

async function tryGet(url) {
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const text = await r.text();
    return { reachable: true, ms: Date.now() - started, httpStatus: r.status, bodyPreview: text.slice(0, 3000) };
  } catch (e) {
    return { reachable: false, ms: Date.now() - started, error: e.name + ': ' + (e.message || String(e)) };
  }
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // Пример прямо из документации (AUTO.JSON.md), только подставлен наш ключ.
  const docExampleUrl = `https://api1.tks.ru/auto.json/json/${KEY}/?cost=15000&volume=1500&currency=840&power=150&power_edizm=ls&country=noru&engine_type=petrol&age=35&face=nat&ts_type=00_8703&mass=&chassis=shs&forwarder=false&caravan=false&offroad=false&buscap=lt120&mdvs_gt_m30ed=true&sequential=false&boat_sea=&sh2017=&bus_municipal_cb=`;

  // Наш реальный случай: Volkswagen Bora, 1.2л/85кВт, физлицо, 3-5 лет, бензин, Китай.
  const ourCaseUrl = `https://api1.tks.ru/auto.json/json/${KEY}/?cost=2000000&currency=643&volume=1200&power=85&power_edizm=kvt&engine_type=petrol&age=35&face=nat&ts_type=00_8703`;

  const [a, b] = await Promise.all([tryGet(docExampleUrl), tryGet(ourCaseUrl)]);
  res.status(200).send(JSON.stringify({ docExample: a, ourCase: b }, null, 1));
};
