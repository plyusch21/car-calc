#!/usr/bin/env node
/* Регрессионный тест формулы: node tools/calc-check.js
   Печатает восемь итогов calcDeal и восемь тел запроса к ТКС (customsPayload)
   для форм из ТЗ 03. Эталон вывода — в tools/calc-fixture.md («Эталон
   calc-check.js»); при любом изменении lib/calc.js вывод должен совпасть
   с эталоном, если формула не менялась намеренно. Курсы и таможня здесь
   подставляются вручную из того же fixture, сеть не нужна. */
const BkCalc = require('../lib/calc.js');

// Курсы из calc-fixture.md (снимок стенда 17.09.2026): value = raw + adjustment
const RATES = { CNY: 12.837, JPY: 0.573, KRW_USDT: 1364, USDT_RUB: 87.1732 };
// Таможня (customsAuto) из calc-fixture.md для каждого из восьми расчётов
const CUSTOMS = ['770661', '813636', '486547', '950367', '358970', '258571', '862413', '16529'];

const cfg = BkCalc.applyStoredConfig(null);
for (const id in RATES) { cfg.rates[id].raw = RATES[id] - cfg.rates[id].adjustment; cfg.rates[id].value = RATES[id]; }

const COMMON = { carPrice:'1000000', extraCosts:'50000', deliveryEnabled:true, deliveryOverride:false, deliveryCity:'Москва', bodyTypeIdx:1 };
const CASES = [
  { n:1, route:'japan', model:'Тест 1 Япония бензин',  patch:{ engineType:'ben', volumeCm3:'1500', power:'100', powerUnit:'ls', age:'t3to5' } },
  { n:2, route:'japan', model:'Тест 2 Япония электро', patch:{ engineType:'electric', volumeCm3:'', power:'150', powerUnit:'kvt', age:'lt3' } },
  { n:3, route:'japan', model:'Тест 3 Япония дизель',  patch:{ engineType:'dis', volumeCm3:'3000', power:'200', powerUnit:'ls', age:'gt5' } },
  { n:4, route:'korea', model:'Тест 4 Корея каталог',  patch:{ engineType:'ben', volumeCm3:'2000', power:'150', powerUnit:'ls', age:'lt3', customsValueOverride:true, customsValueManual:'1200000' } },
  { n:5, route:'korea', model:'Тест 5 Корея электро',  patch:{ engineType:'electric', volumeCm3:'', power:'100', powerUnit:'kvt', age:'t3to5' } },
  { n:6, route:'china', model:'Тест 6 Китай бензин',   patch:{ engineType:'ben', volumeCm3:'1500', power:'110', powerUnit:'ls', age:'t3to5' } },
  { n:7, route:'china', model:'Тест 7 Китай электро',  patch:{ engineType:'electric', volumeCm3:'', power:'200', powerUnit:'ls', age:'lt3' } },
  { n:8, route:'eaeu',  model:'Тест 8 ЕАЭС утильсбор', patch:{ engineType:'ben', volumeCm3:'1600', power:'120', powerUnit:'ls', age:'t3to5', eaeuFullDuty:false } }
];

// Та же форма по умолчанию, что defaultForm() в index.html — без полей,
// не влияющих на расчёт (текстовые параметры авто).
function baseForm(route){
  const r = cfg.routes[route];
  return {
    carPrice:'', extraCosts:r.defaultExtraCosts||'', volumeCm3:'', age:'t3to5', engineType:'ben', power:'', powerUnit:'ls',
    customsAuto:'', customsManual:'', customsOverride:false, eaeuFullDuty:false,
    customsValueOverride:false, customsValueManual:'',
    deliveryCity: cfg.delivery.cities[0].name, bodyTypeIdx:1, deliveryOverride:false, deliveryManual:'', deliveryEnabled:false,
    brokerFee: r.brokerFee, agentFee: r.agentFee, bankPct: r.bankCommissionPct
  };
}

let ok = true;
console.log('== Итоги calcDeal ==');
for (const c of CASES) {
  const f = Object.assign(baseForm(c.route), COMMON, { model:c.model }, c.patch, { customsAuto: CUSTOMS[c.n-1] });
  const r = BkCalc.calcDeal(c.route, f, cfg);
  console.log(`#${c.n} ${c.route.padEnd(5)} invoiceRub=${r.invoiceRub} customs=${r.customsTotal} broker=${r.broker} agent=${r.agent} delivery=${r.delivery} total=${r.total} label=${r.customsLabel}`);
}
console.log('== Тела запроса к ТКС (customsPayload) ==');
for (const c of CASES) {
  const f = Object.assign(baseForm(c.route), COMMON, { model:c.model }, c.patch);
  console.log(`#${c.n} ${JSON.stringify(BkCalc.customsPayload(cfg, c.route, f))}`);
}
console.log('== customsAutoTotal: ЕАЭС без полной пошлины берёт только утильсбор ==');
const eaeuF = Object.assign(baseForm('eaeu'), COMMON, CASES[7].patch);
console.log('eaeu, полная пошлина выкл:', BkCalc.customsAutoTotal(cfg, 'eaeu', eaeuF, { duty: 500000, util: 16529 }));
console.log('eaeu, полная пошлина вкл: ', BkCalc.customsAutoTotal(cfg, 'eaeu', Object.assign({}, eaeuF, { eaeuFullDuty:true }), { duty: 500000, util: 16529 }));
console.log('japan:                    ', BkCalc.customsAutoTotal(cfg, 'japan', eaeuF, { duty: 743909, util: 26752 }));
