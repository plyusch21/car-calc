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
 *   model, carTrim, mileage, prodMonth, prodYear,
 *   drivetrain: 'front'|'rear'|'full'|null,
 *   transmission: 'auto'|'robot'|'variator'|'reductor'|'manual'|null,
 *   condition, notes
 * } — любое поле null/отсутствует, если в тексте не нашлось. Клиент сам
 * решает, в какие поля подставлять (только пустые — так попросил владелец).
 */

const https = require('https');
const tls = require('tls');
const crypto = require('crypto');

const GIGACHAT_AUTH_KEY = process.env.GIGACHAT_AUTH_KEY; // Vercel env var — см. Settings → Environment Variables, never hardcode this here
const GIGACHAT_MODEL = 'GigaChat-2'; // подтверждено GET /v1/models — plain "GigaChat" даёт 404 "No such model"
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
      model: { type: 'string', description: 'марка и модель автомобиля, коротко (напр. "Toyota Alphard", "比亚迪 汉")' },
      carTrim: { type: 'string', description: 'комплектация/trim/грейд, если указан отдельно от модели' },
      mileage: { type: 'number', description: 'пробег в километрах (мили переводить в км, 1 миля = 1.60934 км)' },
      prodMonth: { type: 'integer', description: 'месяц производства/выпуска ТС, 1-12' },
      prodYear: { type: 'integer', description: 'год производства/выпуска ТС (или год модели, если даты выпуска нет), 4 цифры' },
      drivetrain: { type: 'string', enum: ['front', 'rear', 'full'], description: 'привод: front — передний/FWD/前驱, rear — задний/RWD/后驱, full — полный/AWD/4WD/全驱/四驱' },
      transmission: { type: 'string', enum: ['auto', 'robot', 'variator', 'reductor', 'manual'], description: 'трансмиссия: auto — автомат/АКПП/AT, robot — робот/DCT/DSG/双离合, variator — вариатор/CVT, reductor — одноступенчатый редуктор (обычно у электромобилей), manual — механика/МКПП/MT/手动' },
      condition: { type: 'string', description: 'краткое описание состояния своими словами (без дтп, требует ремонта и т.п.), если упомянуто' },
      notes: { type: 'string', description: 'вся остальная существенная информация из текста, не подошедшая под поля выше (доп. опции, цвет, VIN, история обслуживания и т.д.), кратко на русском языке' }
    },
    required: []
  }
};

const PROMPT = `Ты помощник по разбору объявлений о продаже автомобилей для калькулятора импорта. Текст объявления ниже может быть на русском, английском или китайском языке. Вызови функцию extract_car_listing_fields и передай в неё только те поля, которые реально удалось определить из текста — не выдумывай и не заполняй поля, которых в тексте нет.

Текст объявления:
"""
{{TEXT}}
"""`;

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
  return typeof fc.arguments === 'string' ? JSON.parse(fc.arguments) : fc.arguments;
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

  const text = (body.text || '').toString().trim();
  if (!text) {
    res.status(200).send(JSON.stringify({ error: 'пустой текст объявления' }));
    return;
  }
  if (!GIGACHAT_AUTH_KEY) {
    res.status(200).send(JSON.stringify({ error: 'GIGACHAT_AUTH_KEY не настроен на сервере' }));
    return;
  }

  try {
    const token = await getAccessToken();
    const parsed = await callGigaChat(token, text);
    res.status(200).send(JSON.stringify(parsed));
  } catch (e) {
    res.status(200).send(JSON.stringify({ error: e.message || String(e) }));
  }
};
