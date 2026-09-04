/**
 * /api/parse-listing — извлекает поля "Доп. данные по авто" (и марку/модель)
 * из произвольного текста объявления (RU/EN/CN) через GigaChat API (Сбер).
 *
 * История выбора провайдера: перепробовали Gemini (у Google весь Gemini
 * API/AI Studio официально недоступен из России — не вопрос VPN, блок на
 * уровне региона аккаунта), Groq/Grok(xAI) и OpenRouter — с мая 2026
 * OpenRouter тоже режет запросы с российских IP и не принимает оплату из РФ,
 * та же судьба, скорее всего, и у Groq. DeepSeek доступен и недорог, но не
 * бесплатен бессрочно (грант на 30 дней). GigaChat — единственный вариант,
 * который реально доступен из России без VPN и имеет настоящий бесплатный
 * лимит (1 000 000 токенов, продлевается раз в 12 месяцев) — этого с
 * огромным запасом хватает на разбор объявлений.
 *
 * TLS: как и vtb.ru (см. getCny() в api/rates.js), api.giga.chat и
 * ngw.devices.sberbank.ru используют сертификат российского корневого УЦ
 * "Минцифры", которого нет в стандартном доверенном списке — поэтому здесь
 * тот же приём: Node-модуль https с явным добавлением RUSSIAN_TRUSTED_ROOT_CA
 * к доверенным анкорам (не вместо них, и не rejectUnauthorized:false).
 *
 * Авторизация — двухшаговая (типично для экосистемы Сбера):
 *   1. POST ngw.devices.sberbank.ru:9443/api/v2/oauth с Authorization: Basic
 *      <GIGACHAT_AUTH_KEY> (ключ авторизации из личного кабинета
 *      developers.sber.ru) → access_token (живёт 30 минут).
 *   2. POST api.giga.chat/v1/chat/completions с Authorization: Bearer
 *      <access_token>.
 * Токен не кешируем между вызовами: функция запускается редко (разбор
 * объявления по клику), а serverless-инстансы всё равно недолговечны —
 * проще и надёжнее каждый раз получать свежий токен, чем городить кеш.
 *
 * Извлечение полей — через "function calling" (а не response_format с
 * json_schema): именно function calling явно заявлен в документации
 * GigaChat как поддерживаемая OpenAI-совместимая фича, тогда как строгий
 * json_schema-режим для их API не подтверждён.
 *
 * Input (POST JSON body): { text: string }
 * Output: {
 *   model, carTrim,             // ВСЕГДА на английском (см. PROMPT)
 *   mileage, prodMonth, prodYear,
 *   drivetrain: 'front'|'rear'|'full'|null,
 *   transmission: 'auto'|'robot'|'variator'|'reductor'|'manual'|null,
 *   engineType: 'ben'|'dis'|'electric'|null,
 *   volumeCm3, power, powerUnit: 'ls'|'kvt'|null,
 *   condition, notes,           // ВСЕГДА на русском (см. PROMPT)
 *   source: 'ai'|'heuristic'
 * } — любое поле null/отсутствует, если в тексте не нашлось. Клиент сам
 * решает, в какие поля подставлять (только пустые — так попросил владелец).
 * Ответ также содержит source: 'ai'|'heuristic' — см. ниже.
 *
 * Резерв без ИИ: если GigaChat недоступен (сбой ключа/токена/лимита/сети),
 * heuristicParse() ниже пытается вытащить то же самое обычными регулярками
 * по ключевым словам на RU/EN/CN (пробег/год/привод/трансмиссия/объём/
 * мощность), а марку-модель переводит на английский через бесплатный
 * MyMemory Translation API (api.mymemory.translated.net — без ключа и
 * регистрации). Это заведомо менее полный разбор, чем у ИИ: "состояние" и
 * "примечания" регулярками связно не собрать, поэтому эти два поля резерв
 * не заполняет вообще (оставляет пустыми) — честно, это только страховка на
 * случай сбоя, а не полноценная замена.
 */

const https = require('https');
const tls = require('tls');
const crypto = require('crypto');

const GIGACHAT_AUTH_KEY = process.env.GIGACHAT_AUTH_KEY; // Vercel env var — см. Settings → Environment Variables, never hardcode this here
const GIGACHAT_MODEL = 'GigaChat-2'; // подтверждено GET /v1/models — plain "GigaChat" даёт 404 "No such model"
const GIGACHAT_VISION_MODEL = 'GigaChat-2-Pro'; // документация GigaChat заявляет vision именно у Pro-уровня; список моделей "GigaChat-Pro" в чистом виде не содержит
const OAUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
const CHAT_URL = 'https://api.giga.chat/v1/chat/completions';

// Тот же сертификат, что и в api/rates.js (getCny) — см. комментарий там
// про происхождение и проверку цепочки через openssl verify.
const RUSSIAN_TRUSTED_ROOT_CA = `-----BEGIN CERTIFICATE-----
MIIFwjCCA6qgAwIBAgICEAAwDQYJKoZIhvcNAQELBQAwcDELMAkGA1UEBhMCUlUx
PzA9BgNVBAoMNlRoZSBNaW5pc3RyeSBvZiBEaWdpdGFsIERldmVsb3BtZW50IGFu
ZCBDb21tdW5pY2F0aW9uczEgMB4GA1UEAwwXUnVzc2lhbiBUcnVzdGVkIFJvb3Qg
Q0EwHhcNMjIwMzAxMjEwNDE1WhcNMzIwMjI3MjEwNDE1WjBwMQswCQYDVQQGEwJS
VTE/MD0GA1UECgw2VGhlIE1pbmlzdHJ5IG9mIERpZ2l0YWwgRGV2ZWxvcG1lbnQg
YW5kIENvbW11bmljYXRpb25zMSAwHgYDVQQDDBdSdXNzaWFuIFRydXN0ZWQgUm9v
dCBDQTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAMfFOZ8pUAL3+r2n
qqE0Zp52selXsKGFYoG0GM5bwz1bSFtCt+AZQMhkWQheI3poZAToYJu69pHLKS6Q
XBiwBC1cvzYmUYKMYZC7jE5YhEU2bSL0mX7NaMxMDmH2/NwuOVRj8OImVa5s1F4U
zn4Kv3PFlDBjjSjXKVY9kmjUBsXQrIHeaqmUIsPIlNWUnimXS0I0abExqkbdrXbX
YwCOXhOO2pDUx3ckmJlCMUGacUTnylyQW2VsJIyIGA8V0xzdaeUXg0VZ6ZmNUr5Y
Ber/EAOLPb8NYpsAhJe2mXjMB/J9HNsoFMBFJ0lLOT/+dQvjbdRZoOT8eqJpWnVD
U+QL/qEZnz57N88OWM3rabJkRNdU/Z7x5SFIM9FrqtN8xewsiBWBI0K6XFuOBOTD
4V08o4TzJ8+Ccq5XlCUW2L48pZNCYuBDfBh7FxkB7qDgGDiaftEkZZfApRg2E+M9
G8wkNKTPLDc4wH0FDTijhgxR3Y4PiS1HL2Zhw7bD3CbslmEGgfnnZojNkJtcLeBH
BLa52/dSwNU4WWLubaYSiAmA9IUMX1/RpfpxOxd4Ykmhz97oFbUaDJFipIggx5sX
ePAlkTdWnv+RWBxlJwMQ25oEHmRguNYf4Zr/Rxr9cS93Y+mdXIZaBEE0KS2iLRqa
OiWBki9IMQU4phqPOBAaG7A+eP8PAgMBAAGjZjBkMB0GA1UdDgQWBBTh0YHlzlpf
BKrS6badZrHF+qwshzAfBgNVHSMEGDAWgBTh0YHlzlpfBKrS6badZrHF+qwshzAS
BgNVHRMBAf8ECDAGAQH/AgEEMA4GA1UdDwEB/wQEAwIBhjANBgkqhkiG9w0BAQsF
AAOCAgEAALIY1wkilt/urfEVM5vKzr6utOeDWCUczmWX/RX4ljpRdgF+5fAIS4vH
tmXkqpSCOVeWUrJV9QvZn6L227ZwuE15cWi8DCDal3Ue90WgAJJZMfTshN4OI8cq
W9E4EG9wglbEtMnObHlms8F3CHmrw3k6KmUkWGoa+/ENmcVl68u/cMRl1JbW2bM+
/3A+SAg2c6iPDlehczKx2oa95QW0SkPPWGuNA/CE8CpyANIhu9XFrj3RQ3EqeRcS
AQQod1RNuHpfETLU/A2gMmvn/w/sx7TB3W5BPs6rprOA37tutPq9u6FTZOcG1Oqj
C/B7yTqgI7rbyvox7DEXoX7rIiEqyNNUguTk/u3SZ4VXE2kmxdmSh3TQvybfbnXV
4JbCZVaqiZraqc7oZMnRoWrXRG3ztbnbes/9qhRGI7PqXqeKJBztxRTEVj8ONs1d
WN5szTwaPIvhkhO3CO5ErU2rVdUr89wKpNXbBODFKRtgxUT70YpmJ46VVaqdAhOZ
D9EUUn4YaeLaS8AjSF/h7UkjOibNc4qVDiPP+rkehFWM66PVnP1Msh93tc+taIfC
EYVMxjh8zNbFuoc7fzvvrFILLe7ifvEIUqSVIC/AzplM/Jxw7buXFeGP1qVCBEHq
391d/9RAfaZ12zkwFsl+IKwE/OZxW8AHa9i1p4GO0YSNuczzEm4=
-----END CERTIFICATE-----`;

function httpsRequestViaRussianCA(url, method, headers, bodyString) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqHeaders = bodyString ? Object.assign({ 'Content-Length': Buffer.byteLength(bodyString) }, headers) : headers;
    const req = https.request({
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method,
      headers: reqHeaders,
      ca: [...tls.rootCertificates, RUSSIAN_TRUSTED_ROOT_CA] // добавляем к обычному доверенному списку, не заменяем его
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { /* оставим null, вызывающий код сам решит */ }
        resolve({ status: res.statusCode, json, raw: data });
      });
    });
    req.on('error', reject);
    if (bodyString) req.write(bodyString);
    req.end();
  });
}
function httpsPostViaRussianCA(url, headers, bodyString) { return httpsRequestViaRussianCA(url, 'POST', headers, bodyString); }

async function getAccessToken() {
  const { status, json } = await httpsPostViaRussianCA(OAUTH_URL, {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json',
    'RqUID': crypto.randomUUID(),
    'Authorization': 'Basic ' + GIGACHAT_AUTH_KEY
  }, 'scope=GIGACHAT_API_PERS');
  if (status !== 200 || !json || !json.access_token) {
    throw new Error('GigaChat OAuth: не удалось получить токен (http ' + status + (json && json.message ? ': ' + json.message : '') + ')');
  }
  return json.access_token;
}

const FUNCTION_SCHEMA = {
  name: 'extract_car_listing_fields',
  description: 'Извлечь поля автомобиля из текста объявления о продаже',
  parameters: {
    type: 'object',
    properties: {
      model: { type: 'string', description: 'марка и модель автомобиля, коротко, ВСЕГДА на английском языке — переведи/транслитерируй даже из русского или китайского текста (напр. "Toyota Alphard", "Volkswagen T-ROC", "BYD Han EV"). Не включай сюда слова комплектации (см. carTrim).' },
      carTrim: { type: 'string', description: 'комплектация/trim/грейд, если он есть в тексте отдельным словом/фразой (часто идёт последним в названии модели, напр. "...豪华智联版", "...Executive Lounge", "...Long Range", "...Elite"). ВСЕГДА на английском языке — переведи даже из русского или китайского.' },
      mileage: { type: 'number', description: 'пробег в километрах (мили переводить в км, 1 миля = 1.60934 км)' },
      prodMonth: { type: 'integer', description: 'месяц производства/выпуска ТС, 1-12' },
      prodYear: { type: 'integer', description: 'год производства/выпуска ТС (или год модели, если даты выпуска нет), 4 цифры' },
      drivetrain: { type: 'string', enum: ['front', 'rear', 'full'], description: 'привод: front — передний/FWD/前驱, rear — задний/RWD/后驱, full — полный/AWD/4WD/全驱/四驱' },
      transmission: { type: 'string', enum: ['auto', 'robot', 'variator', 'reductor', 'manual'], description: 'трансмиссия: auto — автомат/АКПП/AT, robot — робот/DCT/DSG/双离合, variator — вариатор/CVT, reductor — одноступенчатый редуктор (обычно у электромобилей), manual — механика/МКПП/MT/手动' },
      engineType: { type: 'string', enum: ['ben', 'dis', 'electric'], description: 'тип двигателя: ben — бензиновый/petrol/汽油, dis — дизельный/diesel/柴油, electric — электрический/EV/纯电. Заполняй, только если тип явно понятен из текста.' },
      volumeCm3: { type: 'number', description: 'объём двигателя в см³ — только если явно указан текстом (напр. "2.0L", "1998cc", "排量2.0升", "объём 2 литра"). НЕ вычисляй объём по маркетинговым индексам комплектации/названия (напр. "280TSI", "GLE450") — они не отражают объём напрямую, в этом случае оставь поле пустым.' },
      power: { type: 'number', description: 'мощность двигателя числом — только если явно указана (напр. "150 л.с.", "110 кВт", "馬力180"). НЕ вычисляй по маркетинговым индексам комплектации/названия.' },
      powerUnit: { type: 'string', enum: ['ls', 'kvt'], description: '"kvt" если мощность в тексте указана в кВт/kW, "ls" если в л.с./HP/馬力. Заполняй только вместе с power.' },
      condition: { type: 'string', description: 'краткое описание состояния своими словами (без дтп, требует ремонта и т.п.), если упомянуто. ВСЕГДА на русском языке, даже если исходный текст на английском или китайском — переведи.' },
      notes: { type: 'string', description: 'вся остальная существенная информация из текста, не подошедшая под поля выше (доп. опции, цвет, VIN, история обслуживания и т.д.). ВСЕГДА на русском языке, даже если исходный текст на английском или китайском — переведи.' }
    },
    required: []
  }
};

const PROMPT = `Ты помощник по разбору объявлений о продаже автомобилей для калькулятора импорта. Текст объявления ниже может быть на русском, английском или китайском языке, и может быть оформлен как список полей вида "【название поля】значение" (типично для китайских объявлений) — разбери каждое такое поле по смыслу, не пропускай их. Вызови функцию extract_car_listing_fields и передай в неё только те поля, которые реально удалось определить из текста — не выдумывай и не заполняй поля, которых в тексте нет.

Важно про язык результата: model и carTrim — ВСЕГДА пиши на английском языке (переведи/транслитерируй бренд и модель в их стандартное международное написание), а condition и notes — ВСЕГДА на русском языке (переведи). Ни в одном текстовом поле не должно остаться китайских иероглифов или непереведённых английских слов, кроме самого названия марки/модели/комплектации, которые как раз должны быть на английском.

Текст объявления:
"""
{{TEXT}}
"""`;

// Промпт для аукционного листа (только Япония) — те же поля, но с
// поправкой на японскую специфику: лист всегда на японском, даты в нём —
// это ЭРЫ (令和 Рэйва/平成 Хэйсэй/昭和 Сёва), а главное — там указана дата
// ПЕРВОЙ РЕГИСТРАЦИИ (初度登録), а не дата выпуска — это осознанное решение
// (см. обсуждение с владельцем): не пытаемся вычислить настоящую дату
// выпуска через сторонние декодеры номера кузова (это инструмент прямого
// конкурента, встраивать его в наш калькулятор не будем) — приложение само
// подписывает это поле как "Дата первой регистрации" только для Японии.
const VISION_PROMPT = `Ты помощник по разбору японских аукционных листов (オークションシート) для калькулятора импорта авто. На фото — стандартный лист японского автоаукциона, весь текст на японском языке. Вызови функцию extract_car_listing_fields и передай в неё только то, что реально удалось прочитать на листе.

Важные японские обозначения:
- 初度登録 / 年式 — это ГОД И МЕСЯЦ ПЕРВОЙ РЕГИСТРАЦИИ автомобиля (НЕ дата выпуска — это разные вещи, но здесь для простоты запиши это значение в поля prodYear/prodMonth как есть, дальше это учтёт сам калькулятор).
- Даты на листе часто в форме японских эр: 令和(R) — Рэйва, 1-й год = 2019; 平成(H) — Хэйсэй, 1-й год = 1989; 昭和(S) — Сёва, 1-й год = 1926. Например "R3.5" = Рэйва 3 = 2019+3-1 = 2021 год, 5-й месяц. Переведи такие даты в обычный год/месяц.
- 走行距離 — пробег (обычно в км, если указано "万km" — умножь на 10000).
- シフト/ミッション — трансмиссия (AT/CVT/MT/DCT).
- 駆動 — привод (4WD/2WD, FF=передний, FR=задний).
- 車台番号 — номер кузова/рамы (это НЕ обычный VIN у японских авто для внутреннего рынка) — если виден, добавь в notes.
- Итоговая оценка листа (总合评価/総合評価, обычно число или буква вроде "4.5", "R", "RA") и любые пометки о повреждениях на схеме кузова — кратко перескажи в notes на русском.

Язык результата — как и для текстовых объявлений: model и carTrim ВСЕГДА на английском (переведи/транслитерируй), condition и notes ВСЕГДА на русском (переведи с японского). Не выдумывай значения, которых не видно на листе.`;

async function uploadFile(accessToken, base64Data, mimeType) {
  const buf = Buffer.from(base64Data, 'base64');
  const boundary = '----gigaupload' + crypto.randomUUID().replace(/-/g, '');
  const ext = mimeType && mimeType.includes('png') ? 'png' : 'jpg';
  const head = `--${boundary}\r\nContent-Disposition: form-data; name="purpose"\r\n\r\ngeneral\r\n` +
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="listing.${ext}"\r\nContent-Type: ${mimeType || 'image/jpeg'}\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;
  const body = Buffer.concat([Buffer.from(head, 'utf8'), buf, Buffer.from(tail, 'utf8')]);
  const { status, json } = await httpsPostViaRussianCA('https://api.giga.chat/v1/files', {
    'Content-Type': 'multipart/form-data; boundary=' + boundary,
    'Accept': 'application/json',
    'Authorization': 'Bearer ' + accessToken
  }, body);
  if (status !== 200 || !json || !json.id) {
    throw new Error('GigaChat /files: не удалось загрузить изображение (http ' + status + (json && json.message ? ': ' + json.message : '') + ')');
  }
  return json.id;
}

async function callGigaChatVision(accessToken, fileId) {
  const reqBody = JSON.stringify({
    model: GIGACHAT_VISION_MODEL,
    messages: [
      { role: 'user', content: VISION_PROMPT, attachments: [fileId] }
    ],
    function_call: { name: FUNCTION_SCHEMA.name },
    functions: [FUNCTION_SCHEMA],
    temperature: 0.1
  });
  const { status, json } = await httpsPostViaRussianCA(CHAT_URL, {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': 'Bearer ' + accessToken
  }, reqBody);
  if (status !== 200) {
    throw new Error('GigaChat (фото) http ' + status + (json && json.message ? ': ' + json.message : ''));
  }
  const msg = json && json.choices && json.choices[0] && json.choices[0].message;
  const fc = msg && msg.function_call;
  if (!fc || fc.arguments == null) {
    throw new Error('GigaChat не распознал лист (пустой ответ)');
  }
  const parsed = typeof fc.arguments === 'string' ? JSON.parse(fc.arguments) : fc.arguments;
  parsed.source = 'ai';
  return parsed;
}

async function callGigaChat(accessToken, text) {
  const reqBody = JSON.stringify({
    model: GIGACHAT_MODEL,
    messages: [
      // replace() со строкой-заменой интерпретирует "$"-последовательности в
      // ней ($&, $1 и т.д.) — текст объявления мог случайно их содержать,
      // поэтому подставляем через функцию-замену (её результат берётся как есть).
      { role: 'user', content: PROMPT.replace('{{TEXT}}', () => text.slice(0, 8000)) }
    ],
    function_call: { name: FUNCTION_SCHEMA.name },
    functions: [FUNCTION_SCHEMA],
    temperature: 0.1
  });
  const { status, json } = await httpsPostViaRussianCA(CHAT_URL, {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': 'Bearer ' + accessToken
  }, reqBody);
  if (status !== 200) {
    throw new Error('GigaChat http ' + status + (json && json.message ? ': ' + json.message : ''));
  }
  const msg = json && json.choices && json.choices[0] && json.choices[0].message;
  const fc = msg && msg.function_call;
  if (!fc || fc.arguments == null) {
    throw new Error('GigaChat не вызвал функцию разбора (пустой ответ)');
  }
  const parsed = typeof fc.arguments === 'string' ? JSON.parse(fc.arguments) : fc.arguments;
  parsed.source = 'ai';
  return parsed;
}

// ---------------------------------------------------------------------
// Резерв без ИИ: regex-разбор ключевых слов + бесплатный перевод марки на
// английский (MyMemory, без ключа). См. комментарий в шапке файла.
// ---------------------------------------------------------------------
const CJK_RE = /[一-鿿]/;
const CYRILLIC_RE = /[Ѐ-ӿ]/;

async function translateText(text, sourceLang) {
  const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text.slice(0, 500)) +
    '&langpair=' + sourceLang + '|en';
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const data = await r.json();
    // MyMemory отвечает 200 даже на свои собственные ошибки (лимит, битая
    // пара языков и т.п.) — реальный успех/неуспех смотрим по responseStatus.
    if (!data || data.responseStatus !== 200) return null;
    const out = data.responseData && data.responseData.translatedText;
    return out || null;
  } catch (e) {
    return null;
  }
}

function firstMatch(text, patterns) {
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1] != null) return m[1];
  }
  return null;
}

function heuristicParse(text) {
  const out = {
    model: null, carTrim: null, mileage: null, prodMonth: null, prodYear: null,
    drivetrain: null, transmission: null, engineType: null, volumeCm3: null,
    power: null, powerUnit: null, condition: null, notes: null, source: 'heuristic'
  };

  const mileageRaw = firstMatch(text, [
    /(?:пробег|mileage|里程)[^\d]{0,10}(\d[\d,.\s]{2,})/i,
    /(\d[\d,.\s]{2,})\s*(?:км|km|公里)/i
  ]);
  if (mileageRaw) {
    let n = parseFloat(mileageRaw.replace(/[,\s]/g, ''));
    if (/mile|миль/i.test(text) && !/км|km|公里/i.test(text)) n *= 1.60934;
    if (!isNaN(n) && n > 0) out.mileage = Math.round(n);
  }

  const yearRaw = firstMatch(text, [
    /(?:год выпуска|year|出厂|年份|производства)[^\d]{0,10}(20\d{2}|19\d{2})/i,
    /(20\d{2}|19\d{2})\s*(?:год|г\.|year|年|款)/i
  ]);
  if (yearRaw) out.prodYear = parseInt(yearRaw, 10);

  if (/4wd|awd|полный привод|全驱|四驱|quattro|4matic/i.test(text)) out.drivetrain = 'full';
  else if (/задний привод|\brwd\b|后驱/i.test(text)) out.drivetrain = 'rear';
  else if (/передний привод|\bfwd\b|前驱/i.test(text)) out.drivetrain = 'front';

  if (/робот|\bdsg\b|\bdct\b|双离合/i.test(text)) out.transmission = 'robot';
  else if (/вариатор|\bcvt\b/i.test(text)) out.transmission = 'variator';
  else if (/механика|мкпп|\bmt\b|手动/i.test(text)) out.transmission = 'manual';
  else if (/акпп|автомат|\bat\b|自动挡|自动变速箱/i.test(text)) out.transmission = 'auto';

  if (/электро|electric|\bev\b|纯电|电动/i.test(text)) out.engineType = 'electric';
  else if (/дизель|diesel|柴油/i.test(text)) out.engineType = 'dis';
  else if (/бензин|petrol|汽油/i.test(text)) out.engineType = 'ben';

  const volRaw = firstMatch(text, [
    /(\d\.\d)\s*[LlЛл]\b/,
    /排量\s*(\d\.\d)\s*升/,
    /(\d{3,4})\s*(?:cc|см³|см3|куб)/i
  ]);
  if (volRaw) {
    const n = parseFloat(volRaw);
    out.volumeCm3 = n < 20 ? Math.round(n * 1000) : Math.round(n); // "2.0" -> см3, "1998" уже см3
  }

  const powerLs = firstMatch(text, [/(\d{2,4})\s*(?:л\.?с\.?|hp|马力)/i]);
  const powerKvt = firstMatch(text, [/(\d{2,4})\s*(?:кВт|kw|千瓦)/i]);
  if (powerLs) { out.power = parseInt(powerLs, 10); out.powerUnit = 'ls'; }
  else if (powerKvt) { out.power = parseInt(powerKvt, 10); out.powerUnit = 'kvt'; }

  // Марку/модель регулярками надёжно не выделить — берём первую содержательную
  // строку текста (до первой цифры/запятой), чистим китайские скобочные метки
  // вида "【...】" и переводим на английский, если она не на латинице.
  const firstLine = text.split(/\n/).map(s => s.trim()).find(s => s.length > 1) || '';
  const modelGuess = firstLine.replace(/[【][^】]*[】]/g, '').replace(/[,，、].*$/, '').trim().slice(0, 80);
  out.model = modelGuess || null;

  return out;
}

async function heuristicParseWithTranslation(text) {
  const out = heuristicParse(text);
  if (out.model) {
    const srcLang = CJK_RE.test(out.model) ? 'zh' : (CYRILLIC_RE.test(out.model) ? 'ru' : null);
    if (srcLang) {
      const translated = await translateText(out.model, srcLang);
      if (translated) out.model = translated;
    }
  }
  return out;
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

  // Фото аукционного листа (пока только маршрут "Япония" на клиенте) — своя
  // ветка: картинку не разобрать регуляркой-резервом (heuristicParse работает
  // только с текстом), поэтому здесь при сбое GigaChat просто честная ошибка,
  // без попытки подстраховки.
  const image = (body.image || '').toString();
  if (image) {
    if (!GIGACHAT_AUTH_KEY) {
      res.status(200).send(JSON.stringify({ error: 'GIGACHAT_AUTH_KEY не настроен на сервере' }));
      return;
    }
    try {
      const token = await getAccessToken();
      const fileId = await uploadFile(token, image, (body.mimeType || '').toString());
      const parsed = await callGigaChatVision(token, fileId);
      res.status(200).send(JSON.stringify(parsed));
    } catch (e) {
      res.status(200).send(JSON.stringify({ error: e.message || String(e) }));
    }
    return;
  }

  const text = (body.text || '').toString().trim();
  if (!text) {
    res.status(200).send(JSON.stringify({ error: 'пустой текст объявления' }));
    return;
  }
  // GigaChat — основной путь; при любом сбое (нет ключа, не удалось получить
  // токен, лимит, сеть, странный ответ) — резерв без ИИ, а не жёсткая ошибка.
  // См. заголовок файла: резерв заведомо менее полный, но лучше частичный
  // разбор, чем ничего.
  let aiError = null;
  try {
    if (!GIGACHAT_AUTH_KEY) throw new Error('GIGACHAT_AUTH_KEY не настроен на сервере');
    const token = await getAccessToken();
    const parsed = await callGigaChat(token, text);
    res.status(200).send(JSON.stringify(parsed));
    return;
  } catch (e) {
    aiError = e.message || String(e);
  }

  try {
    const fallback = await heuristicParseWithTranslation(text);
    fallback.aiError = aiError;
    res.status(200).send(JSON.stringify(fallback));
  } catch (e) {
    res.status(200).send(JSON.stringify({ error: 'GigaChat недоступен (' + aiError + '), резервный разбор тоже не удался: ' + (e.message || String(e)) }));
  }
};
