/**
 * TEMPORARY diagnostic endpoint — see commit message / conversation for
 * context. Tries several payload variants against calc.tks.ru to isolate
 * what calc.tks.ru actually accepts. Delete once resolved either way.
 */

const apiKey = '87434b095e3f4d6fa8febccee738b9bf';

async function tryPayload(payload) {
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
    return { reachable: true, ms: Date.now() - started, httpStatus: tksRes.status, bodyPreview: text.slice(0, 1500) };
  } catch (e) {
    return { reachable: false, ms: Date.now() - started, error: e.name + ': ' + (e.message || String(e)) };
  }
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const today = new Date().toISOString().slice(0, 10);

  // Вариант A: ровно пример из README (только дата актуальная) — проверяем, что ключ/эндпоинт вообще работают.
  const variantA = {
    kontrakt: { NUM: 1, G221: '840', G542: today },
    kontdop: [{
      NUM: 1, G32: 1, G33: '2709001001', G34: '008',
      G45: 559288.0, G45V: '643', G38: 1000.0,
      GEDI1: 1000.0, GEDI2: null, GEDI3: null,
      IMP: 5.0, IMP2: null, IMP3: null, IMPEDI: '1', IMPEDI2: null, IMPEDI3: null,
      IMPPREF: null, IMPSIGN: null, IMPSIGN2: null,
      NDS: 18.0, NDSEDI: null,
      AKC: null, AKC2: null, AKC3: null, AKCEDI: null, AKCEDI2: null, AKCEDI3: null, AKCSIGN: null, AKCSIGN2: null,
      IMPCOMP: null, IMPCOMP2: null, IMPCOMPEDI: null, IMPCOMPEDI2: null, IMPCOMPSIGN: null,
      IMPDEMP: null, IMPDEMP2: null, IMPDEMPEDI: null, IMPDEMPEDI2: null, IMPDEMPSIGN: null,
      IMPDOP: null,
      IMPTMP: null, IMPTMP2: null, IMPTMPEDI: null, IMPTMPEDI2: null, IMPTMPSIGN: null,
      EXP: 0.0, EXP2: null, EXP3: null, EXPEDI: '1', EXPEDI2: null, EXPEDI3: null, EXPSIGN: null, EXPSIGN2: null
    }]
  };

  // Вариант B: наш случай (авто, объём в см3), без явных null, минимальный набор полей.
  const variantB = {
    kontrakt: { NUM: 1, G221: '643', G542: today },
    kontdop: [{
      NUM: 1, G32: 1, G33: '8703239024', G34: '156',
      G45: 2000000.0, G45V: '643',
      GEDI2: 2494.0,
      IMP: 3.0, IMPEDI: '1'
    }]
  };

  // Вариант C: как B, но с весом G38 (может быть обязателен для этой товарной группы).
  const variantC = {
    kontrakt: { NUM: 1, G221: '643', G542: today },
    kontdop: [{
      NUM: 1, G32: 1, G33: '8703239024', G34: '156',
      G45: 2000000.0, G45V: '643', G38: 1500.0,
      GEDI2: 2494.0,
      IMP: 3.0, IMPEDI: '1'
    }]
  };

  const [a, b, c] = await Promise.all([tryPayload(variantA), tryPayload(variantB), tryPayload(variantC)]);
  res.status(200).send(JSON.stringify({ variantA_readmeExample: a, variantB_ourCase: b, variantC_withWeight: c }, null, 1));
};
