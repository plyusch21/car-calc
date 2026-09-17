/* =====================================================================
   lib/calc.js — формула расчёта и всё, что ей нужно, в одном месте.

   Подключается обычным <script src="/lib/calc.js?v=N"> и в index.html,
   и в deals.html (без модулей и сборщиков — принятое решение). Объявляет
   один глобальный объект BkCalc и больше ничего в глобальную область не
   пишет; в Node подключается через require (см. tools/calc-check.js).

   Функции НЕ читают глобальный CONFIG — конфиг всегда передаётся аргументом:
     BkCalc.calcDeal(route, f, cfg, ratesValues)
     BkCalc.deliveryPrice(cfg, city, bodyIdx)
     BkCalc.convertToRub(cfg, route, carPrice, extraCosts, bankPct, ratesValues)
     BkCalc.customsPayload(cfg, route, f)          — тело запроса к ТКС (без initData)
     BkCalc.customsAutoTotal(cfg, route, f, res)   — что из ответа ТКС идёт в customsAuto
   ratesValues — необязательная подмена курсов {JPY, KRW_USDT, USDT_RUB, CNY}:
   если передана, convertToRub берёт значения оттуда, иначе cfg.rates[id].value.
   Подмены CONFIG.rates «на время» нет и не должно быть — есть этот аргумент.

   При каждом изменении этого файла поднимать ?v=N в обоих html (кэш).
   ===================================================================== */
(function(){

const DEFAULT_CONFIG = {

  rates: {
    CNY: {
      label:'ЮАНЬ / ₽', short:'ЮАНЬ',
      sourceUrl:'https://www.vtb.ru/personal/platezhi-i-perevody/obmen-valjuty/',
      sourceNote:'ВТБ Онлайн (без подписок и пакетов услуг), курс продажи, транш «до 100 ¥» — тот же публичный JSON, который использует сама страница ВТБ. Если сделка выходит за этот транш, курс на сайте будет немного другим — подправьте вручную при необходимости.',
      autoAvailable:true, manualOverride:false, proxyKey:'cny', adjustment:0, adjustmentLabel:'',
      raw: 13.19, autoRaw:13.19, value:13.19, updatedAt:null
    },
    JPY: {
      label:'ЙЕНА / ₽', short:'ЙЕНА',
      sourceUrl:'https://www.atb.su/services/exchange/',
      sourceNote:'АТБ Банк, вкладка «для денежных переводов», курс продажи (за 1 йену).',
      autoAvailable:true, manualOverride:false, proxyKey:'jpy', adjustment:0, adjustmentLabel:'',
      raw: 0.5730, autoRaw:0.5730, value:0.5730, updatedAt:null
    },
    KRW_USDT: {
      label:'USDT / ВОНА', short:'USDT/ВОНА',
      sourceUrl:'https://search.naver.com/search.naver?where=nexearch&sm=top_sug.pre&fbm=0&acr=1&acq=usdt&qdt=0&ie=utf8&query=usdt&ackey=op24n8r1',
      sourceNote:'Значение на Naver минус 5 (по договорённости с площадкой обмена).',
      autoAvailable:true, manualOverride:false, proxyKey:'usdtKrw', adjustment:-5, adjustmentLabel:'− 5',
      raw: 1409, autoRaw:1409, value:1404, updatedAt:null
    },
    USDT_RUB: {
      label:'USDT / ₽', short:'USDT/₽',
      sourceUrl:'https://www.cbr.ru/currency_base/daily/',
      sourceNote:'Официальный курс доллара США ЦБ РФ, плюс 3 (по договорённости с площадкой обмена). Раньше брали с Investing.com, но тот блокирует запросы с сервера — курс ЦБ надёжнее и всё равно уже используется в приложении для евро.',
      autoAvailable:true, manualOverride:false, direct:true, directUrl:'https://www.cbr-xml-daily.ru/daily_json.js', directPath:'Valute.USD.Value',
      adjustment:3, adjustmentLabel:'+ 3',
      raw: 86.83, autoRaw:86.83, value:89.83, updatedAt:null
    }
  },

  // Proxy endpoint that fetches ATB / Naver / Investing.com server-side
  // (browsers cannot fetch these cross-origin). See README for deploying
  // this as a Vercel/Cloudflare serverless function.
  proxyUrl: '/api/rates',

  // Пошлина и утильсбор считаются на сервере через api/customs.js (см.
  // комментарий в начале файла и в самом api/customs.js — почему это
  // проксирует alta.ru, а не tks.ru напрямую).
  customsProxyUrl: '/api/customs',

  // Разбор вставленного текста объявления (комплектация/пробег/дата/привод/
  // трансмиссия/состояние + марка-модель) через api/parse-listing.js (GigaChat).
  parseListingUrl: '/api/parse-listing',

  customsCalculators: [
    { label:'alta.ru — auto-vat', url:'https://www.alta.ru/auto-vat/' },
    { label:'tks.ru — auto/calc', url:'https://www.tks.ru/auto/calc/' }
  ],

  // ---- delivery cost matrix (Владивосток → город, по типу кузова) ------
  // From your reference table. Editable / extendable in Settings.
  delivery: {
    originLabel: 'Владивосток',
    bodyTypes: ['Кей-кар', 'Седан / универсал / хэтчбек', 'Кроссовер', 'Джип / внедорожник / минивэн'],
    cities: [
      { name:'Чита',            prices:[120000,125000,130000,135000] },
      { name:'Улан-Удэ',        prices:[120000,125000,130000,135000] },
      { name:'Иркутск',         prices:[120000,125000,130000,135000] },
      { name:'Красноярск',      prices:[130000,140000,150000,160000] },
      { name:'Кемерово',        prices:[130000,140000,150000,160000] },
      { name:'Новосибирск',     prices:[130000,140000,150000,160000] },
      { name:'Омск',            prices:[155000,165000,170000,175000] },
      { name:'Тюмень',          prices:[165000,175000,185000,195000] },
      { name:'Челябинск',       prices:[180000,185000,190000,200000] },
      { name:'Екатеринбург',    prices:[180000,185000,190000,200000] },
      { name:'Уфа',             prices:[180000,185000,190000,200000] },
      { name:'Пермь',           prices:[180000,185000,190000,200000] },
      { name:'Тольятти',        prices:[190000,195000,205000,210000] },
      { name:'Самара',          prices:[190000,195000,205000,210000] },
      { name:'Ижевск',          prices:[190000,195000,205000,210000] },
      { name:'Москва',          prices:[205000,215000,225000,235000] },
      { name:'Казань',          prices:[205000,215000,225000,235000] },
      { name:'Нижний Новгород', prices:[205000,215000,225000,235000] },
      { name:'Владимир',        prices:[205000,215000,225000,235000] },
      { name:'Чебоксары',       prices:[205000,215000,225000,235000] },
      { name:'Воронеж',         prices:[215000,225000,235000,245000] },
      { name:'Саратов',         prices:[215000,225000,235000,245000] },
      { name:'Ростов-на-Дону',  prices:[215000,225000,235000,245000] },
      { name:'Волгоград',       prices:[215000,225000,235000,245000] },
      { name:'Краснодар',       prices:[215000,225000,235000,245000] },
      { name:'Санкт-Петербург', prices:[225000,235000,245000,255000] }
    ]
  },

  // ---- per-route defaults ------------------------------------------------
  routes: {
    china: { label:'Китай', currency:'CNY', bankCommissionPct:2.5, brokerFee:90000, agentFee:50000, dutyMode:'precise', defaultExtraCosts:'' },
    japan: { label:'Япония', currency:'JPY', bankCommissionPct:1.5, brokerFee:80000, agentFee:50000, dutyMode:'precise', defaultExtraCosts:'' },
    korea: { label:'Корея',  currency:'KRW', bankCommissionPct:0,   brokerFee:85000, agentFee:50000, dutyMode:'precise', defaultExtraCosts:'' },
    eaeu:  { label:'ЕАЭС', currency:'USDT', bankCommissionPct:0, brokerFee:100000, agentFee:50000, dutyMode:'utilOnly', defaultExtraCosts:'' }
  }
};

// Курсы валют — как их брать (источник, автообновляемость, корректировка,
// текст-подсказка) — это решение из кода и должно обновляться с каждым
// релизом, а не застревать на том, что когда-то сохранилось у пользователя
// в localStorage/на сервере. Синхронизируем только сами значения (raw/
// value/manualOverride и т.п.), а метаданные источника всегда берём
// из свежего DEFAULT_CONFIG — иначе, например, включив автообновление
// юаня в коде, все уже открывавшие приложение так и останутся с
// «вручную», потому что старая сохранённая копия каждый раз перекрывает
// новый код при подгрузке.

function deepMerge(base, override){
  if(Array.isArray(base)) return override!==undefined ? override : base;
  if(typeof base === 'object' && base!==null){
    const out = {...base};
    for(const k in base){ out[k] = deepMerge(base[k], override ? override[k] : undefined); }
    if(override){ for(const k in override){ if(!(k in base)) out[k]=override[k]; } }
    return out;
  }
  return override!==undefined ? override : base;
}

function mergeRatesState(defaultRates, storedRates){
  const out = {};
  for(const id in defaultRates){
    const def = defaultRates[id];
    out[id] = {...def};
    const st = (storedRates && storedRates[id]) || {};
    ['raw','value','autoRaw','autoUpdatedAt','updatedAt','manualOverride','problemFlag','problemReason','rejectedRaw'].forEach(k=>{
      if(st[k]!==undefined) out[id][k] = st[k];
    });
    // Раньше у части курсов (например, юаня) автообновления вообще не было,
    // и manualOverride был принудительным, а не осознанным выбором. Если код
    // теперь умеет обновлять курс сам, а автозначения при этом никогда не
    // было (autoRaw пусто) — это точно старый вынужденный режим, а не то,
    // что человек сам когда-то включил, поэтому снимаем галочку один раз.
    if(st.manualOverride===true && (st.autoRaw===undefined || st.autoRaw===null) && def.autoAvailable===true){
      out[id].manualOverride = false;
    }
  }
  return out;
}
// Те же грабли, что чинили для курсов: label/currency/dutyMode/defaultExtraCosts
// маршрутов — это константы кода, их нельзя редактировать через приложение, и
// они не должны браться из старого синхронизированного стейта (иначе правка
// названия вкладки в коде навсегда перекрывается тем, что уже сохранено на
// устройстве/сервере пользователя). Реально редактируемые через Настройки поля
// (брокер/комиссия/% банка) — наоборот, обязаны сохраняться между сессиями.
function mergeRoutesState(defaultRoutes, storedRoutes){
  const out = {};
  for(const id in defaultRoutes){
    const def = defaultRoutes[id];
    out[id] = {...def};
    const st = (storedRoutes && storedRoutes[id]) || {};
    ['brokerFee','agentFee','bankCommissionPct'].forEach(k=>{
      if(st[k]!==undefined) out[id][k] = st[k];
    });
  }
  return out;
}
function applyStoredConfig(stored){
  const merged = deepMerge(JSON.parse(JSON.stringify(DEFAULT_CONFIG)), stored || {});
  merged.rates = mergeRatesState(DEFAULT_CONFIG.rates, stored && stored.rates);
  merged.routes = mergeRoutesState(DEFAULT_CONFIG.routes, stored && stored.routes);
  return merged;
}

const ENGINE_TYPES = {
  ben:      { label:'Бензиновый',   dtype:'ben' },
  dis:      { label:'Дизельный',    dtype:'dis' },
  electric: { label:'Электрический', dtype:'electric' }
};
function num(v){ const n=parseFloat(String(v).replace(',','.')); return isNaN(n)?0:n; }
const CUSTOMS_AGE_CODE = { lt3:'age0', t3to5:'age3', gt5:'age5' };

// Курс для пересчёта в рубли: подмена (ratesValues) приоритетнее конфига.
function rateValue(cfg, ratesValues, id){
  if(ratesValues && ratesValues[id]!==undefined && ratesValues[id]!==null) return ratesValues[id];
  return cfg.rates[id].value;
}

/* ---- Delivery lookup ------------------------------------------------- */
function deliveryPrice(cfg, cityName, bodyIdx){
  const c = cfg.delivery.cities.find(x=>x.name===cityName);
  if(!c) return 0;
  return c.prices[bodyIdx] || 0;
}

/* ---- Route → RUB conversion chains ----------------------------------- */
function convertToRub(cfg, route, carPrice, extraCosts, bankPct, ratesValues){
  const subtotal = (carPrice + extraCosts) * (1 + bankPct/100);
  if(route==='japan') return subtotal * rateValue(cfg, ratesValues, 'JPY');
  if(route==='korea'){ const usd = subtotal / rateValue(cfg, ratesValues, 'KRW_USDT'); return usd * rateValue(cfg, ratesValues, 'USDT_RUB'); }
  if(route==='china') return subtotal * rateValue(cfg, ratesValues, 'CNY');
  if(route==='eaeu')  return subtotal * rateValue(cfg, ratesValues, 'USDT_RUB');
  return 0;
}

/* ---- Main calculation ------------------------------------------------ */
function calcDeal(route, f, cfg, ratesValues){
  const carPrice = num(f.carPrice), extra = num(f.extraCosts);
  const bankPct = cfg.routes[route].bankCommissionPct;
  const invoiceRub = convertToRub(cfg, route, carPrice, extra, bankPct, ratesValues);
  const invoiceRubNoCommission = convertToRub(cfg, route, carPrice, extra, 0, ratesValues);
  const bankCommissionRub = invoiceRub - invoiceRubNoCommission;
  const routeCfg = cfg.routes[route];

  const customsTotal = f.customsOverride ? num(f.customsManual) : num(f.customsAuto);

  const broker = num(f.brokerFee);
  const agent = num(f.agentFee);
  const delivery = f.deliveryEnabled ? (f.deliveryOverride ? num(f.deliveryManual) : deliveryPrice(cfg, f.deliveryCity, f.bodyTypeIdx)) : 0;
  const downPayment = broker; // by policy, the deposit always equals the broker fee

  const total = invoiceRub + customsTotal + broker + agent + delivery;
  // Для текста "Поделиться" клиенту нужны цена/комиссия в исходной валюте и
  // эффективный курс — считаем их здесь же, чтобы не дублировать формулу.
  const nativeTotal = carPrice + extra;
  const nativeCommission = nativeTotal * bankPct / 100;
  const effectiveRate = nativeTotal > 0 ? invoiceRubNoCommission / nativeTotal : 0;
  return {
    invoiceRub, customsTotal, broker, agent, delivery, total, downPayment,
    bankPct, bankCommissionRub, nativeTotal, nativeCommission, effectiveRate,
    customsLabel: (routeCfg.dutyMode==='utilOnly' && !f.eaeuFullDuty) ? 'Утилизационный сбор' : 'Таможенные платежи'
  };
}

/* ---- Тело запроса к ТКС (api/customs.js) ------------------------------
   Без initData и без fetch — их добавляет вызывающая сторона. */
function customsPayload(cfg, route, f){
  // Таможенную стоимость сервер конвертирует сам по официальному курсу ЦБ РФ
  // (то же самое использует и сам tks.ru) — поэтому здесь передаём цену в
  // исходной валюте сделки, БЕЗ нашей комиссии банка (это наша маржа, не
  // часть стоимости авто для таможни) и без наших собственных курсов ВТБ/АТБ.
  const routeCfg = cfg.routes[route];
  // Таможенная стоимость по каталогу (для авто младше 3 лет, когда цена по
  // факту ниже каталожной) — если тумблер включён и значение введено, именно
  // оно уходит в расчёт пошлины/утильсбора вместо цены сделки. Цена сделки и
  // итоговая стоимость для клиента (calcDeal) от этого не меняются.
  const catalogValue = num(f.customsValueManual);
  const carValue = (f.customsValueOverride && catalogValue > 0) ? catalogValue : (num(f.carPrice) + num(f.extraCosts));
  const carCurrency = routeCfg.currency === 'USDT' ? 'USD' : routeCfg.currency;
  const em = ENGINE_TYPES[f.engineType] || ENGINE_TYPES.ben;
  const isElectric = em.dtype === 'electric';

  return {
    ageCode: CUSTOMS_AGE_CODE[f.age],
    carValue,
    carCurrency,
    volumeCm3: isElectric ? 0 : num(f.volumeCm3),
    dtype: em.dtype,
    // Единственное поле мощности на форме ("Мощность электродвигателя" для
    // электро, "Мощность двигателя" для остальных) всегда пишет в
    // f.power. TKS всегда берёт мощность из "power" независимо от типа
    // двигателя (раньше здесь стоял 0 для электро — TKS получал мощность 0
    // и не мог посчитать акциз/утильсбор, отсюда пустой ответ). Дублируем
    // то же значение в powerElectric для чистого электро — это поле alta.ru
    // уже использовало для электромобилей до этого фикса и давало верный
    // результат, так что оставляем и его для надёжности резерва.
    power: num(f.power),
    powerUnit: f.powerUnit,
    powerElectric: isElectric ? num(f.power) : 0,
    powerElectricUnit: f.powerUnit
  };
}

/* ---- Что из ответа ТКС идёт в customsAuto ----------------------------
   Для ЕАЭС без включённой полной пошлины — только утильсбор; иначе
   пошлина + утильсбор. Возвращает округлённую сумму в рублях. */
function customsAutoTotal(cfg, route, f, res){
  const isEaeu = cfg.routes[route].dutyMode==='utilOnly' && !f.eaeuFullDuty;
  return Math.round((isEaeu ? 0 : (res.duty||0)) + (res.util||0));
}

const BkCalc = {
  DEFAULT_CONFIG, deepMerge, mergeRatesState, mergeRoutesState, applyStoredConfig,
  ENGINE_TYPES, num, CUSTOMS_AGE_CODE,
  deliveryPrice, convertToRub, calcDeal, customsPayload, customsAutoTotal
};
if (typeof window !== 'undefined') window.BkCalc = BkCalc;
if (typeof module !== 'undefined') module.exports = BkCalc;
})();
