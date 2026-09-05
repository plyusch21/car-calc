/**
 * /api/parse-listing — извлекает поля "Доп. данные по авто" (и марку/модель)
 * из произвольного текста объявления (RU/EN/CN/JP) через GigaChat API (Сбер).
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
 * по ключевым словам на RU/EN/CN/JP (пробег/год(вкл. японские эры)/привод/трансмиссия/объём/
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
// Базовая GigaChat-2 на плотном японском тексте (без пробелов между
// смысловыми блоками) регулярно выдумывала числовые поля, которых не было
// в тексте вообще (объём двигателя, мощность), даже после многократного
// усиления промпта — похоже на ограничение самой модели, а не формулировки.
// GigaChat-2-Pro (та же, что уже используется для фото) заметно надёжнее.
// Бесплатного лимита (десятки миллионов токенов) хватает на Pro с большим
// запасом при такой редкой и лёгкой задаче, как разбор одного объявления.
const GIGACHAT_MODEL = 'GigaChat-2-Pro';
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

// Лимит запросов на стороне самого GigaChat — не наша ошибка и не то, что
// чинится повтором прямо сейчас (обычно снимается за десятки секунд), так
// что для него отдельное понятное сообщение вместо голого "http 429".
function throwIfRateLimited(status) {
  if (status === 429) {
    throw new Error('GigaChat временно ограничил число запросов (слишком много подряд) — подождите примерно минуту и попробуйте снова');
  }
}

async function getAccessToken() {
  const { status, json } = await httpsPostViaRussianCA(OAUTH_URL, {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json',
    'RqUID': crypto.randomUUID(),
    'Authorization': 'Basic ' + GIGACHAT_AUTH_KEY
  }, 'scope=GIGACHAT_API_PERS');
  throwIfRateLimited(status);
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
      transmission: { type: 'string', enum: ['auto', 'robot', 'variator', 'reductor', 'manual'], description: 'трансмиссия: auto — классический гидротрансформаторный автомат/АКПП/AT/Tiptronic (НЕ путать с DSG/DCT — это robot, а не auto, даже если в тексте это называют "автоматом" в бытовом смысле), robot — робот с двумя сцеплениями/DCT/DSG/PDK/S-tronic/双离合, variator — вариатор/CVT, reductor — одноступенчатый редуктор (обычно у электромобилей), manual — механика/МКПП/MT/手动' },
      engineType: { type: 'string', enum: ['ben', 'dis', 'electric'], description: 'тип двигателя: ben — бензиновый/petrol/汽油, dis — дизельный/diesel/柴油, electric — электрический/EV/纯电. Заполняй ТОЛЬКО если тип топлива явно НАЗВАН словом в тексте (бензин/petrol/gasoline/汽油, дизель/diesel/柴油 и т.п.). Категорически ЗАПРЕЩЕНО угадывать тип по обозначению двигателя вроде "1.4T"/"2.0T"/"TSI"/"TDI" — буква T/turbo сама по себе НЕ говорит о топливе (бывает и бензиновый, и дизельный турбомотор). Если явного слова про топливо нет — оставь поле пустым.' },
      volumeCm3: { type: 'number', description: 'объём двигателя в см³ — только если явно указан текстом (напр. "2.0L", "1998cc", "排量2.0升", "объём 2 литра"). НЕ вычисляй объём по маркетинговым индексам комплектации/названия (напр. "280TSI", "GLE450") — они не отражают объём напрямую, в этом случае оставь поле пустым.' },
      power: { type: 'number', description: 'мощность двигателя числом — только если явно указана (напр. "150 л.с.", "110 кВт", "馬力180"). НЕ вычисляй по маркетинговым индексам комплектации/названия.' },
      powerUnit: { type: 'string', enum: ['ls', 'kvt'], description: '"kvt" если мощность в тексте указана в кВт/kW, "ls" если в л.с./HP/馬力. Заполняй только вместе с power.' },
      condition: { type: 'string', description: 'краткое описание состояния своими словами (без дтп, требует ремонта и т.п.), если упомянуто. ВСЕГДА на русском языке, даже если исходный текст на английском или китайском — переведи.' },
      notes: { type: 'string', description: 'вся остальная существенная информация из текста, не подошедшая под поля выше (доп. опции, цвет, VIN, история обслуживания и т.д.). НЕ повторяй здесь то, что уже указано в других полях (комплектация, пробег, дата, привод, трансмиссия, объём/мощность двигателя, состояние) — только то, для чего нет отдельного поля. ВСЕГДА на русском языке, даже если исходный текст на английском или китайском — переведи.' }
    },
    required: []
  }
};

const PROMPT = `Ты помощник по разбору объявлений о продаже автомобилей для калькулятора импорта. Текст объявления ниже может быть на русском, английском, китайском или японском языке, и может быть оформлен как список полей вида "【название поля】значение" (типично для китайских и японских объявлений) — разбери каждое такое поле по смыслу, не пропускай их. Если текст на японском и в нём есть дата в формате эры (令和/R, 平成/H, 昭和/S) — переведи её в обычный год: год = (год эры) + (год начала эры) - 1, где 令和(R) начинается в 2019, 平成(H) — в 1989, 昭和(S) — в 1926. Вызови функцию extract_car_listing_fields и передай в неё только те поля, которые реально удалось определить из текста — не выдумывай и не заполняй поля, которых в тексте нет.

Важно про язык результата: model и carTrim — ВСЕГДА пиши на английском языке (переведи/транслитерируй бренд и модель в их стандартное международное написание), а condition и notes — ВСЕГДА на русском языке (переведи). Это касается и списков опций/особенностей из объявления (напр. "4WD, 1.4T engine, cruise control" — переведи КАЖДЫЙ пункт списка, а не оставляй список как есть просто потому что он уже выглядит как готовый текст). Ни в одном текстовом поле не должно остаться китайских или японских иероглифов/каны, или непереведённых английских слов, кроме самого названия марки/модели/комплектации, которые как раз должны быть на английском.

Две частые ошибки, которых нужно избегать:
1. DSG/DCT/PDK/S-tronic — это трансмиссия с двумя сцеплениями, в схеме это "robot", а НЕ "auto", даже если в объявлении её бытовым языком называют "автомат" (технически это не гидротрансформаторный автомат).
2. Обозначения вроде "1.4T"/"2.0T"/TSI/TDI — это НЕ прямое указание на тип топлива (T значит турбонаддув, который бывает и у бензиновых, и у дизельных моторов). Для engineType используй ТОЛЬКО прямое слово о топливе в тексте (бензин/petrol/дизель/diesel и т.п.) — без него оставляй engineType пустым.
3. Поле notes — только для того, чему нет отдельного поля в схеме. Не пересказывай в notes то, что уже попало в carTrim/mileage/prodYear/prodMonth/drivetrain/transmission/volumeCm3/power/condition — это дублирование.

Текст объявления:
"""
{{TEXT}}
"""

Финальное и самое важное правило: описания полей функции (то, что написано в скобках вроде "например ...") — это ПОДСКАЗКИ ДЛЯ ТЕБЯ, а не примеры значений, которые нужно вставить. Заполняй поле только тем, что реально написано в тексте объявления выше. Если для какого-то поля в тексте нет данных — оставь его пустым/null. Никогда не копируй формулировки из описаний полей (например "без дтп, требует ремонта" из описания condition) как будто это факт про конкретный автомобиль — это лишь пример формата ответа, а не текст для вставки.`;

// Промпт для аукционного листа (только Япония) — те же поля, но с
// поправкой на японскую специфику: лист всегда на японском, даты в нём —
// это ЭРЫ (令和 Рэйва/平成 Хэйсэй/昭和 Сёва), а главное — там указана дата
// ПЕРВОЙ РЕГИСТРАЦИИ (初度登録), а не дата выпуска — это осознанное решение
// (см. обсуждение с владельцем): не пытаемся вычислить настоящую дату
// выпуска через сторонние декодеры номера кузова (это инструмент прямого
// конкурента, встраивать его в наш калькулятор не будем) — приложение само
// подписывает это поле как "Дата первой регистрации" только для Японии.
// isAuctionSheet — отдельная защита от галлюцинаций: живой тест показал, что
// модель без этого поля уверенно "придумывала" полностью правдоподобные
// Toyota Alphard/пробег/VIN/оценку по картинке, где не было вообще никакого
// аукционного листа (это была системная иконка Bluetooth). Явное булево
// поле + жёсткая инструкция резко снижают этот риск — если false, сервер
// ниже вообще не отдаёт остальные поля клиенту.
const VISION_FUNCTION_SCHEMA = {
  name: FUNCTION_SCHEMA.name,
  description: FUNCTION_SCHEMA.description,
  parameters: {
    type: 'object',
    properties: Object.assign({
      isAuctionSheet: { type: 'boolean', description: 'true ТОЛЬКО если на фото действительно виден настоящий японский аукционный лист (オークションシート) с читаемыми полями. false — если это любое другое изображение, нечитаемое/размытое фото, случайный скриншот и т.п. Это поле ОБЯЗАТЕЛЬНО в каждом ответе.' }
    }, FUNCTION_SCHEMA.parameters.properties),
    required: ['isAuctionSheet']
  }
};

const VISION_PROMPT = `Ты помощник по разбору японских аукционных листов (オークションシート) для калькулятора импорта авто. Сначала проверь: действительно ли на фото виден настоящий японский аукционный лист с читаемыми полями? Если НЕТ (это любое другое изображение, случайный скриншот, размытое/нечитаемое фото, вообще не документ) — вызови функцию extract_car_listing_fields с isAuctionSheet=false и ВСЕМИ остальными полями пустыми/null, и НИЧЕГО не придумывай. Категорически запрещено сочинять правдоподобные марку/пробег/VIN/даты, если ты их не видишь на изображении — лучше пустое поле, чем выдуманное значение.

Если лист есть и читаем — вызови функцию с isAuctionSheet=true и передай только то, что реально удалось прочитать.

КРИТИЧЕСКИ ВАЖНО — на листе часто рядом стоят ДВА РАЗНЫХ поля с датами в формате японских эр, их легко перепутать:
- 初度登録年月 (иногда просто 初度登録 или 年式) — ДАТА ПЕРВОЙ РЕГИСТРАЦИИ автомобиля. ИМЕННО ЭТО значение пиши в prodYear/prodMonth.
- 車検 (шакен, срок техосмотра) — это СОВСЕМ ДРУГОЕ поле (когда действует техосмотр), обычно указано КАК ГОД ПОЗЖЕ даты регистрации. НИКОГДА не путай его с 初度登録 и не пиши его значение в prodYear/prodMonth.
Если видишь оба поля рядом — бери дату строго из того, что подписано 初度登録 (или 年式), а не из 車検.

Формат японских эр: 令和(R) — Рэйва, 1-й год = 2019; 平成(H) — Хэйсэй, 1-й год = 1989; 昭和(S) — Сёва, 1-й год = 1926. Формула: год = (год эры) + (год начала эры) - 1. Например "R4" и месяц "7" (может быть записано как "R4/7月", "R4.7", "4年7月" рядом с уже напечатанным "令和") = Рэйва 4 = 2019+4-1 = 2022 год, 7-й месяц.

Другие поля листа (типичные подписи, могут немного отличаться по формату на разных бланках):
- 車名 — марка (напр. メルセデス・ベンツ = Mercedes-Benz). Часто рядом строкой ниже/правее — модель и грейд/комплектация вместе (напр. "GLA180 AMGライン" → модель "GLA180", комплектация "AMG Line").
- 排気量 — объём двигателя в см³, указан просто числом (напр. "1400") — это explicit-поле, а не маркетинговый индекс, смело используй его для volumeCm3.
- 走行 / 走行距離 — пробег, часто с запятой как разделителем тысяч (напр. "17,297" = 17297 км; если "万km" — умножь число на 10000).
- シフト / ミッション — трансмиссия: AT/CAT/オートマ → auto; CVT → variator; MT/マニュアル → manual; DCT/DSG/デュアルクラッチ → robot (DSG/DCT — это НЕ "auto", даже если по смыслу это тоже автоматическая коробка). Если код не из этого списка и непонятен — оставь поле пустым, не угадывай.
- 駆動 — привод: "4WD"/"AWD" → full; "FF" → front; "FR" → rear. Если написано просто "2WD" без уточнения FF/FR — привод неоднозначен (может быть и передний, и задний), оставь поле пустым, не угадывай.
- 燃料 — тип топлива (ガソリン=бензин→ben, ディーゼル=дизель→dis, 電気/EV=электро→electric). Используй ТОЛЬКО это явное поле — не определяй топливо по обозначению двигателя (напр. "1.4T", "2.0T") или объёму, они не говорят однозначно о типе топлива.
- ハンドル — расположение руля (右=правый/左=левый) — если указано, добавь в notes ("правый руль"/"левый руль").
- 車台番号 — номер кузова/рамы (у японских брендов для внутреннего рынка это НЕ обычный VIN, у авто зарубежных марок типа Mercedes/BMW часто настоящий VIN) — если виден, добавь в notes.
- 外色/内装色 — цвет кузова/салона — если видно, кратко добавь в notes.
- 評価点 (общая оценка листа, обычно число вроде "4.5" или буква R/RA) и 内装 (оценка салона, буква) — добавь в notes ("Оценка аукциона: 4.5, салон B").
- ◎検査員報告 / 検査コメント (комментарий инспектора о состоянии — царапины, вмятины, загрязнения и т.п.) — это и есть поле condition, переведи на русский кратко.
- ◎注意事項 (修復・不具合箇所および状態等) — это поле по названию про повреждения, но на практике туда часто пишут и доп. комплектацию (напр. "レーダーセーフティパッケージ" = пакет радар-безопасности) — прочитай осмысленно и раздели: то, что похоже на неисправность/повреждение → в condition, то что похоже на опцию/комплектацию → в notes.
- セールスポイント (сильные стороны/доп. опции, напр. "360°ビューカメラ" = камера кругового обзора, "パワーバックドア" = электропривод двери багажника) — добавь в notes.
- Не путай регистрационный номер (登録番号, напр. "一宮 300 は 4617" — автомобильный номерной знак) ни с чем из перечисленного — это не нужно извлекать вообще.

Язык результата — как и для текстовых объявлений: model и carTrim ВСЕГДА на английском (переведи/транслитерируй), condition и notes ВСЕГДА на русском (переведи с японского). Не выдумывай значения, которых не видно на листе. Поле notes — только для того, чему нет отдельного поля в схеме, не дублируй в нём то, что уже попало в carTrim/mileage/prodYear/prodMonth/drivetrain/transmission/volumeCm3/power/condition.

Финальное и самое важное правило: описания полей функции (то, что написано в скобках вроде "например ...") — это ПОДСКАЗКИ ДЛЯ ТЕБЯ, а не примеры значений для вставки. Заполняй поле только тем, что реально видно на листе. Если чего-то не видно — оставь поле пустым/null. Никогда не копируй формулировки из описаний полей (например "без дтп, требует ремонта" из описания condition) как будто это факт про конкретный автомобиль.`;

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
  throwIfRateLimited(status);
  if (status !== 200 || !json || !json.id) {
    throw new Error('GigaChat /files: не удалось загрузить изображение (http ' + status + (json && json.message ? ': ' + json.message : '') + ')');
  }
  return json.id;
}

async function callGigaChatVisionOnce(accessToken, fileId) {
  const reqBody = JSON.stringify({
    model: GIGACHAT_VISION_MODEL,
    messages: [
      { role: 'user', content: VISION_PROMPT, attachments: [fileId] }
    ],
    function_call: { name: VISION_FUNCTION_SCHEMA.name },
    functions: [VISION_FUNCTION_SCHEMA],
    temperature: 0.1
  });
  const { status, json } = await httpsPostViaRussianCA(CHAT_URL, {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': 'Bearer ' + accessToken
  }, reqBody);
  throwIfRateLimited(status);
  if (status !== 200) {
    throw new Error('GigaChat (фото) http ' + status + (json && json.message ? ': ' + json.message : ''));
  }
  const msg = json && json.choices && json.choices[0] && json.choices[0].message;
  const fc = msg && msg.function_call;
  if (!fc || fc.arguments == null) {
    // Модель иногда вместо вызова функции отвечает обычным текстом (отказ,
    // "не вижу изображения" и т.п.) — раньше эта информация терялась, и
    // ошибка всегда звучала одинаково-непонятно ("пустой ответ"), что делало
    // разбор причины вслепую. Теперь показываем реальный текст ответа модели,
    // если он есть — по нему видно, отказ это, сбой формата или что-то ещё.
    const plain = msg && typeof msg.content === 'string' ? msg.content.trim() : '';
    const suffix = plain ? (': «' + plain.slice(0, 300) + '»') : ' (совсем без текста)';
    const err = new Error('GigaChat не распознал лист — модель не вызвала функцию разбора' + suffix);
    err.emptyFunctionCall = true;
    throw err;
  }
  const parsed = typeof fc.arguments === 'string' ? JSON.parse(fc.arguments) : fc.arguments;
  if (parsed.isAuctionSheet === false) {
    throw new Error('На фото не удалось распознать японский аукционный лист — проверьте фото (чёткость, освещение) и попробуйте снова');
  }
  delete parsed.isAuctionSheet;
  parsed.source = 'ai';
  return enforceRussianFields(sanityCheckParsed(parsed));
}

// GigaChat иногда (судя по всему, эпизодически/на конкретном запросе) не
// вызывает функцию вообще — похоже на разовый сбой формата ответа, а не на
// системную проблему с фото, т.к. тот же файл при повторном запросе обычно
// разбирается нормально. Поэтому один автоматический повтор перед тем, как
// сдаться и показать ошибку — дешёвая и оправданная подстраховка.
async function callGigaChatVision(accessToken, fileId) {
  try {
    return await callGigaChatVisionOnce(accessToken, fileId);
  } catch (e) {
    if (!e.emptyFunctionCall) throw e;
    return await callGigaChatVisionOnce(accessToken, fileId);
  }
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
  throwIfRateLimited(status);
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
  // Живой тест показал: на плотном японском тексте с датой-эрой (напр.
  // "初度登録 R4年7月") модель не просто ошибается в арифметике года — она
  // путает поля местами (пробег в объём двигателя, дату — в "состояние").
  // Дата по японской эре — это просто арифметика, для неё код надёжнее
  // угадывания моделью, поэтому здесь принудительно пересчитываем и
  // подставляем prodYear/prodMonth сами, если в исходном тексте нашлась
  // такая дата — независимо от того, что там решила вернуть модель.
  const era = parseEraDate(text);
  if (era) { parsed.prodYear = era.year; parsed.prodMonth = era.month; }
  return enforceRussianFields(sanityCheckParsed(parsed, text));
}

// ---------------------------------------------------------------------
// Резерв без ИИ: regex-разбор ключевых слов + бесплатный перевод марки на
// английский (MyMemory, без ключа). См. комментарий в шапке файла.
// ---------------------------------------------------------------------
const CJK_RE = /[一-鿿]/;
const CYRILLIC_RE = /[Ѐ-ӿ]/;

async function translateText(text, sourceLang, targetLang) {
  const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text.slice(0, 500)) +
    '&langpair=' + sourceLang + '|' + (targetLang || 'en');
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

// Подстраховка: GigaChat периодически игнорирует инструкцию "condition/notes
// всегда на русском" (живой пример: длинный список опций на английском —
// "4WD powerful, 1.4T engine, tire pressure monitoring..." — ушёл клиенту
// как есть). Промпт/схема одни не гарантируют соблюдение — поэтому здесь
// после ответа модели явно проверяем долю кириллицы в этих двух полях и,
// если перевода явно не произошло, переводим сами через MyMemory.
function looksUntranslatedToRussian(text) {
  if (!text) return false;
  const cyrillic = (text.match(/[Ѐ-ӿ]/g) || []).length;
  const letters = (text.match(/[a-zA-Zа-яА-ЯЀ-ӿ一-鿿]/g) || []).length;
  if (letters < 3) return false; // слишком коротко, чтобы судить (напр. одно слово/аббревиатура)
  return cyrillic / letters < 0.3;
}
async function enforceRussianFields(parsed) {
  for (const key of ['condition', 'notes']) {
    const val = parsed[key];
    if (typeof val === 'string' && looksUntranslatedToRussian(val)) {
      const srcLang = CJK_RE.test(val) ? 'zh' : 'en';
      const translated = await translateText(val, srcLang, 'ru');
      if (translated) parsed[key] = translated;
    }
  }
  return parsed;
}

// Ещё одна подстраховка от того же случая (плотный японский текст сбивает
// модель): если пробег не нашёлся вообще — пробуем достать его регуляркой
// (text доступен только для текстового пути, не для фото). А объём
// двигателя вне разумных пределов для легкового авто — почти наверняка
// не объём, а случайно попавшее туда другое число (живой пример: модель
// подставила туда пробег 17297) — в этом случае лучше пустое поле, чем
// заведомо абсурдное значение в расчёте.
function sanityCheckParsed(parsed, text) {
  if (text && (parsed.mileage == null || parsed.mileage === '')) {
    const mileageRaw = firstMatch(text, [
      /(?:пробег|mileage|里程|走行距離|走行)[^\d]{0,10}(\d[\d,.\s]{2,})/i,
      /(\d[\d,.\s]{2,})\s*(?:км|km|公里)/i
    ]);
    if (mileageRaw) {
      const n = parseFloat(mileageRaw.replace(/[,\s]/g, ''));
      if (!isNaN(n) && n > 0) parsed.mileage = Math.round(n);
    }
  }
  if (parsed.volumeCm3 != null && (parsed.volumeCm3 < 200 || parsed.volumeCm3 > 9000)) {
    parsed.volumeCm3 = null;
  }
  return parsed;
}

function firstMatch(text, patterns) {
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1] != null) return m[1];
  }
  return null;
}

// Японские эры (令和 Рэйва с 2019, 平成 Хэйсэй с 1989, 昭和 Сёва с 1926) —
// год = год начала эры + номер года эры - 1. Поддерживаем и иероглифы, и
// латинские сокращения (R/H/S), т.к. в объявлениях встречаются оба варианта.
function parseEraDate(text) {
  // "年"/"月" как разделитель нужен и кандзи-варианту (令和4年7月), и
  // латинскому (R4年7月 — распространённый смешанный формат на аукционных
  // листах) — раньше латинский вариант принимал только "." или "/" и не
  // находил именно эту, самую частую запись.
  const eras = [['令和', 2019], ['平成', 1989], ['昭和', 1926], ['R', 2019], ['H', 1989], ['S', 1926]];
  for (const [marker, start] of eras) {
    const isKanji = /[一-鿿]/.test(marker);
    const re = new RegExp((isKanji ? marker : '\\b' + marker) + '\\s*(\\d{1,2})[\\.\\/年]\\s*(\\d{1,2})?');
    const m = text.match(re);
    if (m) return { year: start + parseInt(m[1], 10) - 1, month: m[2] ? parseInt(m[2], 10) : null };
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
    /(?:пробег|mileage|里程|走行距離|走行)[^\d]{0,10}(\d[\d,.\s]{2,})/i,
    /(\d[\d,.\s]{2,})\s*(?:км|km|公里)/i
  ]);
  if (mileageRaw) {
    let n = parseFloat(mileageRaw.replace(/[,\s]/g, ''));
    if (/mile|миль/i.test(text) && !/км|km|公里/i.test(text)) n *= 1.60934;
    if (!isNaN(n) && n > 0) out.mileage = Math.round(n);
  }

  // Японские эры (令和/平成/昭和 или латиницей R/H/S) идут раньше обычного
  // регулярного года — на японских листах/объявлениях года почти всегда в
  // этом формате, а не как обычное 4-значное число.
  const era = parseEraDate(text);
  if (era) {
    out.prodYear = era.year;
    if (era.month) out.prodMonth = era.month;
  } else {
    const yearRaw = firstMatch(text, [
      /(?:год выпуска|year|出厂|年份|производства|初度登録|年式)[^\d]{0,10}(20\d{2}|19\d{2})/i,
      /(20\d{2}|19\d{2})\s*(?:год|г\.|year|年|款)/i
    ]);
    if (yearRaw) out.prodYear = parseInt(yearRaw, 10);
  }

  if (/4wd|awd|полный привод|全驱|四驱|quattro|4matic/i.test(text)) out.drivetrain = 'full';
  else if (/задний привод|\brwd\b|后驱|\bfr\b/i.test(text)) out.drivetrain = 'rear';
  else if (/передний привод|\bfwd\b|前驱|\bff\b/i.test(text)) out.drivetrain = 'front';

  if (/робот|\bdsg\b|\bdct\b|双离合/i.test(text)) out.transmission = 'robot';
  else if (/вариатор|\bcvt\b/i.test(text)) out.transmission = 'variator';
  else if (/механика|мкпп|\bmt\b|手动|マニュアル/i.test(text)) out.transmission = 'manual';
  else if (/акпп|автомат|\bat\b|自动挡|自动变速箱|オートマ/i.test(text)) out.transmission = 'auto';

  if (/электро|electric|\bev\b|纯电|电动|電気|電動/i.test(text)) out.engineType = 'electric';
  else if (/дизель|diesel|柴油|ディーゼル/i.test(text)) out.engineType = 'dis';
  else if (/бензин|petrol|gasoline|汽油|ガソリン/i.test(text)) out.engineType = 'ben';

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
