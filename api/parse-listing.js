/**
 * /api/parse-listing — извлекает поля "Доп. данные по авто" (и марку/модель)
 * из произвольного текста объявления (RU/EN/CN) через Google Gemini API.
 *
 * Почему Gemini: у него есть по-настоящему бесплатный тариф без карты
 * (ключ на aistudio.google.com/apikey) и нативный режим строгого JSON-вывода
 * по схеме (responseSchema) — не нужно самому парсить произвольный текстовый
 * ответ модели и гадать, не сломался ли формат. Модель хорошо работает с
 * многоязычным текстом (важно для китайских объявлений — сравнивали с
 * бесплатными моделями Groq (Llama) и с Grok(xAI, платный, без надёжного
 * бесплатного тарифа) — у Gemini лучшее сочетание "бесплатно + китайский").
 *
 * Лимиты бесплатного тарифа gemini-2.0-flash (на момент написания):
 * ~15 запросов/мин, ~1500 запросов/день, 1 000 000 токенов/мин — для разбора
 * объявлений (по одному запросу за раз) этого более чем достаточно.
 *
 * Input (POST JSON body): { text: string }
 * Output: {
 *   model, carTrim, mileage, prodMonth, prodYear,
 *   drivetrain: 'front'|'rear'|'full'|null,
 *   transmission: 'auto'|'robot'|'variator'|'reductor'|'manual'|null,
 *   condition, notes
 * } — любое поле null, если в тексте не нашлось. Клиент сам решает, в какие
 * поля подставлять (только пустые — так попросил владелец), сервер об этом
 * ничего не знает.
 */

const GEMINI_KEY = process.env.GEMINI_API_KEY; // Vercel env var — см. Settings → Environment Variables, never hardcode this here
const GEMINI_MODEL = 'gemini-2.0-flash';

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    model: { type: 'STRING', nullable: true },
    carTrim: { type: 'STRING', nullable: true },
    mileage: { type: 'NUMBER', nullable: true },
    prodMonth: { type: 'INTEGER', nullable: true },
    prodYear: { type: 'INTEGER', nullable: true },
    drivetrain: { type: 'STRING', enum: ['front', 'rear', 'full'], nullable: true },
    transmission: { type: 'STRING', enum: ['auto', 'robot', 'variator', 'reductor', 'manual'], nullable: true },
    condition: { type: 'STRING', nullable: true },
    notes: { type: 'STRING', nullable: true }
  },
  required: []
};

const PROMPT = `Ты помощник по разбору объявлений о продаже автомобилей для калькулятора импорта. Текст объявления ниже может быть на русском, английском или китайском языке. Извлеки из него поля и верни JSON строго по заданной схеме. Если поле не удаётся определить из текста — верни null.

- model: марка и модель автомобиля, коротко (напр. "Toyota Alphard", "比亚迪 汉").
- carTrim: комплектация/trim/грейд, если указан отдельно от модели.
- mileage: пробег в километрах, числом. Если в тексте указаны мили — переведи в километры (1 миля = 1.60934 км).
- prodMonth (1-12) и prodYear (4 цифры): месяц и год производства/выпуска ТС. Если явной даты выпуска нет, но указан год модели — используй его как prodYear.
- drivetrain: один из "front" (передний/FWD/前驱), "rear" (задний/RWD/后驱), "full" (полный/AWD/4WD/全驱/四驱). Иначе null.
- transmission: один из "auto" (автомат/АКПП/AT), "robot" (робот/DCT/DSG/双离合), "variator" (вариатор/CVT), "reductor" (одноступенчатый редуктор — обычно у электромобилей), "manual" (механика/МКПП/MT/手动). Иначе null.
- condition: краткое описание состояния своими словами (без дтп, требует ремонта, отличное состояние и т.п.), если упомянуто в тексте.
- notes: вся остальная существенная информация об автомобиле из текста, которая не подошла под поля выше (доп. опции, цвет, VIN, история обслуживания и т.д.) — объедини в короткий связный текст на русском языке. Если ничего лишнего нет — null.

Текст объявления:
"""
{{TEXT}}
"""`;

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

  const text = (body.text || '').toString().trim();
  if (!text) {
    res.status(200).send(JSON.stringify({ error: 'пустой текст объявления' }));
    return;
  }
  if (!GEMINI_KEY) {
    res.status(200).send(JSON.stringify({ error: 'GEMINI_API_KEY не настроен на сервере' }));
    return;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
  const reqBody = {
    // replace() со строкой-заменой интерпретирует "$"-последовательности в
    // ней ($&, $1 и т.д.) — текст объявления мог случайно их содержать,
    // поэтому подставляем через функцию-замену (её результат берётся как есть).
    contents: [{ parts: [{ text: PROMPT.replace('{{TEXT}}', () => text.slice(0, 8000)) }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.1
    }
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody),
      signal: controller.signal
    });
    const data = await r.json();
    if (!r.ok) {
      const msg = (data && data.error && data.error.message) || ('gemini http ' + r.status);
      res.status(200).send(JSON.stringify({ error: 'Gemini: ' + msg }));
      return;
    }
    const textOut = data.candidates && data.candidates[0] && data.candidates[0].content &&
      data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
    if (!textOut) {
      res.status(200).send(JSON.stringify({ error: 'Gemini вернул пустой ответ (возможно, сработал фильтр безопасности)' }));
      return;
    }
    let parsed;
    try { parsed = JSON.parse(textOut); } catch (e) {
      res.status(200).send(JSON.stringify({ error: 'Gemini вернул невалидный JSON' }));
      return;
    }
    res.status(200).send(JSON.stringify(parsed));
  } catch (e) {
    res.status(200).send(JSON.stringify({ error: e.name === 'AbortError' ? 'Gemini не ответил за 20с' : (e.message || String(e)) }));
  } finally {
    clearTimeout(timeout);
  }
};
