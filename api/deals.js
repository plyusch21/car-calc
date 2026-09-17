/**
 * /api/deals — учёт сделок и контрагентов.
 *
 * Хранение: КАЖДАЯ сделка и КАЖДЫЙ контрагент — отдельный ключ в KV, а не
 * общий блоб (как state:config/state:history у калькулятора). С разделом
 * работают несколько человек одновременно, и сохранение одним куском
 * затирало бы чужие правки: двое открыли список, каждый поправил свою
 * сделку — побеждает тот, кто сохранил последним, правки первого исчезают.
 * Отдельные ключи такого класса ошибок не имеют вовсе.
 *
 * Схема ключей:
 *   deal:<id>        STRING  полная запись сделки
 *   deals:idx        HASH    <id> → короткая строка для списка (см. dealIndexRow)
 *   party:<id>       STRING  полная запись контрагента
 *   parties:idx      HASH    <id> → короткая строка для списка
 *   parties:phone    HASH    <нормализованный телефон> → <id контрагента>
 *   deal:<id>:log    LIST    история изменений, RPUSH (атомарно, записи
 *                            не теряются при одновременной работе)
 *   deals:seq:<год>  STRING  счётчик номеров, INCR
 *
 * Индекс нужен, чтобы экран списка не тянул полные записи всех сделок:
 * HGETALL по одному ключу вместо сотни отдельных чтений.
 *
 * Этапы сделки СЕРВЕР НЕ ЗНАЕТ и знать не должен: их перечень живёт в коде
 * страницы (deals.html), а сюда приходит уже посчитанная клиентом сводка
 * (текущий этап, дата движения, признак архива) — она только для списка.
 * Так перечень этапов остаётся в одном месте и заведомо не попадает в
 * синхронизируемые настройки (тот же принцип, что описан в CLAUDE.md про
 * белый список полей CONFIG).
 */

const crypto = require('crypto');
const { kv } = require('./_lib/kv');
const { authenticate, dealsLevelOf } = require('./_lib/access');

const DEAL_TYPES = ['import', 'paperwork'];
const ROUTES = ['japan', 'korea', 'china', 'eaeu'];
const PARTY_KINDS = ['person', 'dealer'];
const LEVELS = ['none', 'own', 'read_all', 'full'];

const newId = () => crypto.randomBytes(8).toString('hex');
const str = (v, max) => String(v == null ? '' : v).slice(0, max || 500);
const oneOf = (v, list) => (list.indexOf(v) === -1 ? null : v);

// Курсы, зафиксированные у снимка расчёта при «Оплата инвойса — пройден»
// (ТЗ 04): { at, values:{JPY,KRW_USDT,USDT_RUB,CNY}, source, missing }.
// Сервер их только хранит и приводит к форме; считает и подбирает — клиент
// (recalcBookedCalc в deals.html). null — инвойс ещё не оплачен.
const RATE_IDS = ['JPY', 'KRW_USDT', 'USDT_RUB', 'CNY'];
function cleanRatesLock(x) {
  if (!x || typeof x !== 'object') return null;
  const values = {};
  RATE_IDS.forEach(id => {
    const n = Number(x.values && x.values[id]);
    if (Number.isFinite(n) && n > 0) values[id] = n;
  });
  return {
    at: Number(x.at) || 0,
    values,
    source: x.source === 'history' ? 'history' : 'current',
    missing: Array.isArray(x.missing) ? x.missing.filter(m => RATE_IDS.indexOf(m) !== -1) : []
  };
}
// ДД.ММ.ГГГГ для строки лога. Клиент присылает дату сам (ratesDate) — у него
// локальное время владельца; это запасной вариант, если не прислал.
function ddMmYyyy(ts) {
  const d = new Date(Number(ts) || Date.now());
  return String(d.getUTCDate()).padStart(2, '0') + '.' + String(d.getUTCMonth() + 1).padStart(2, '0') + '.' + d.getUTCFullYear();
}

// Телефон сравниваем по цифрам: "+7 (999) 123-45-67", "8 999 1234567" и
// "79991234567" — один и тот же человек. Ведущую 8 приводим к 7.
function normPhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1);
  return d;
}

async function nextDealNumber() {
  const year = new Date().getFullYear();
  const n = await kv('INCR', 'deals:seq:' + year);
  return 'BA-' + year + '-' + String(n).padStart(4, '0');
}

// Короткая строка для экрана списка. stageKey/stageAt/archived приходят от
// клиента (только он знает перечень этапов) — это производные данные для
// показа, не источник правды: сами отметки лежат в полной записи.
function dealIndexRow(deal) {
  return {
    id: deal.id,
    num: deal.num,
    dealNum: deal.dealNum || '',
    type: deal.type,
    route: deal.route,
    sanctioned: !!deal.sanctioned,
    partyId: deal.partyId || '',
    partyName: deal.partyName || '',
    partyKind: deal.partyKind || '',
    // Нужен и списку (кого показывать), и удалению сделки: по нему видно,
    // держит ли ещё кто-то ссылку на физика, прежде чем убирать его запись.
    endBuyerId: deal.endBuyerId || '',
    car: deal.car || '',
    stageKey: deal.stageKey || '',
    stageState: deal.stageState || '',
    stageAt: deal.stageAt || 0,
    responsibleUid: (deal.responsible && deal.responsible.uid) || '',
    responsibleName: (deal.responsible && deal.responsible.name) || '',
    problem: !!(deal.problem && deal.problem.on),
    archived: !!deal.archived,
    createdAt: deal.createdAt || 0
  };
}

function partyIndexRow(party) {
  return {
    id: party.id,
    kind: party.kind,
    name: party.name,
    phone: party.phone || '',
    city: party.city || '',
    dealerId: party.dealerId || '',
    telegramUsername: party.telegramUsername || ''
  };
}

async function readHash(key) {
  const raw = await kv('HGETALL', key);
  const out = [];
  for (let i = 0; i < (raw || []).length; i += 2) {
    try { out.push(JSON.parse(raw[i + 1])); } catch (e) { /* битая запись — пропускаем */ }
  }
  return out;
}

async function readLog(dealId) {
  const raw = await kv('LRANGE', 'deal:' + dealId + ':log', -300, -1);
  return (raw || []).map(s => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean);
}

async function appendLog(dealId, auth, text) {
  const entry = { at: Date.now(), uid: auth.uid, name: auth.record.name || ('id ' + auth.uid), text: str(text, 300) };
  await kv('RPUSH', 'deal:' + dealId + ':log', JSON.stringify(entry));
  return entry;
}

// Что именно изменилось — чтобы в логе было "перевёл этап «таможня» в
// пройден", а не безликое "изменил сделку".
function describeChanges(before, after) {
  const out = [];
  if (!before) return ['создал сделку'];
  const plain = [
    ['partyName', 'контрагент'],
    ['route', 'маршрут'], ['car', 'что ищем'], ['deliveryCity', 'город доставки'],
    ['notes', 'заметки'], ['budget', 'бюджет'], ['wishes', 'пожелания'], ['year', 'год'],
    ['num', 'номер сделки'], ['dealNum', '№ договора'], ['dealDate', 'дата договора']
  ];
  plain.forEach(([k, label]) => {
    if (str(before[k]) !== str(after[k])) out.push('изменил ' + label);
  });
  const rBefore = (before.responsible && before.responsible.name) || '';
  const rAfter = (after.responsible && after.responsible.name) || '';
  if (rBefore !== rAfter) out.push('ответственный: ' + (rAfter || 'не назначен'));

  const sBefore = before.stages || {};
  const sAfter = after.stages || {};
  Object.keys(sAfter).forEach(key => {
    const b = sBefore[key] || {};
    const a = sAfter[key] || {};
    if (b.state !== a.state) {
      // У «Договор / Предоплата» состояние skip значит не «не требуется», а
      // «без предоплаты» — см. skipLabel в STAGE_TEMPLATES (deals.html).
      const word = a.state === 'done' ? 'пройден'
        : (a.state === 'skip' ? (key === 'contract' ? 'без предоплаты' : 'не требуется')
        : (a.state === 'wip' ? 'в процессе' : 'снят'));
      // Деньги по сделке фиксируются прямо в отметке этапа (amount) — без
      // этого куска в логе поступление денег нигде не было бы видно.
      // Взнос поступает на «Договор / Предоплата» (amount там), «Бронь» его
      // удерживает — если предоплата вообще была.
      let money = (a.state === 'done' && typeof a.amount === 'number')
        ? ' — поступило ' + Math.round(a.amount) + ' ₽' : '';
      if (key === 'booking' && a.state === 'done' && sAfter.contract && sAfter.contract.state !== 'skip') {
        money += ' — предоплата удержана';
      }
      out.push('этап «' + str(a.label || key, 60) + '» — ' + word + money);
    } else {
      // Сумма могла дофиксироваться позже самой отметки: у сделки с
      // несколькими расчётами источника нет, пока не поставят бронь.
      if (a.state === 'done' && typeof a.amount === 'number' && a.amount !== b.amount) {
        out.push('зафиксирована сумма по этапу «' + str(a.label || key, 60) + '»: ' + Math.round(a.amount) + ' ₽');
      }
      if (str(b.note) !== str(a.note)) out.push('заметка к этапу «' + str(a.label || key, 60) + '»');
    }
  });
  Object.keys(sBefore).forEach(key => {
    if (!sAfter[key]) out.push('снял отметку этапа «' + str(sBefore[key].label || key, 60) + '»');
  });

  const pBefore = !!(before.problem && before.problem.on);
  const pAfter = !!(after.problem && after.problem.on);
  if (pBefore !== pAfter) out.push(pAfter ? 'отметил проблему: ' + str((after.problem || {}).reason, 120) : 'снял отметку проблемы');

  const cBefore = (before.calcs || []).length;
  const cAfter = (after.calcs || []).length;
  if (cAfter > cBefore) out.push('привязал расчёт');
  if (cAfter < cBefore) out.push('отвязал расчёт');

  if (!before.archived && after.archived) out.push('сделка закрыта и ушла в архив');
  if (before.archived && !after.archived) out.push('сделка возвращена из архива');

  return out;
}

// Право на конкретную сделку. Владелец и 'full' — всё; 'read_all' видит все,
// но правит только свои; 'own' видит и правит только свои. "Свой" — тот, кто
// назначен ответственным (по uid). Сделку с ответственным, вписанным просто
// текстом, "своей" не считает никто — это осознанно: такой ответственный не
// пользователь приложения, и привязать её не к кому.
function canRead(level, deal, uid) {
  if (level === 'full' || level === 'read_all') return true;
  if (level === 'own') return (deal.responsible && deal.responsible.uid) === uid || deal.createdBy === uid;
  return false;
}
function canWrite(level, deal, uid) {
  if (level === 'full') return true;
  if (level === 'own' || level === 'read_all') {
    return (deal.responsible && deal.responsible.uid) === uid || deal.createdBy === uid;
  }
  return false;
}

// Контрагенты — тот же дух, что и canRead/canWrite для сделок, но раньше
// вообще не проверялся (ЗАДАНИЕ.md Блок 9): уровень «только свои» видел и
// правил всю базу дилеров, включая условия работы. 'own' — только те
// контрагенты, что связаны хоть с одной ВИДИМОЙ ему сделкой; 'read_all' и
// 'full' и так видят все сделки, поэтому им и контрагентов не сужаем —
// иначе только что созданный, но ещё ни к одной сделке не привязанный
// контрагент был бы не найти.
function visiblePartyIds(deals) {
  const ids = new Set();
  for (const d of deals) {
    if (d.partyId) ids.add(d.partyId);
    if (d.endBuyerId) ids.add(d.endBuyerId);
  }
  return ids;
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

  try {
    const auth = await authenticate(body.initData);
    if (!auth.ok) { res.status(401).send(JSON.stringify({ error: auth.error })); return; }
    if (auth.record.status !== 'approved') {
      res.status(401).send(JSON.stringify({ error: 'доступ не подтверждён', status: auth.record.status }));
      return;
    }
    const level = dealsLevelOf(auth.record);
    if (level === 'none') {
      res.status(401).send(JSON.stringify({ error: 'Раздел учёта сделок вам не открыт — попросите владельца выдать доступ' }));
      return;
    }
    const uid = auth.uid;
    const action = body.action;

    if (action === 'bootstrap') {
      const [deals, allParties] = await Promise.all([readHash('deals:idx'), readHash('parties:idx')]);
      // d.removed — наследие прежнего «мягкого» удаления: такие записи
      // считаются удалёнными и не показываются нигде; их никто не дочищает
      // (таких записей не осталось, отдельный крон под это не нужен).
      const visible = deals.filter(d => !d.removed && canRead(level, d, uid));
      const parties = (level === 'own' && !auth.record.isOwner)
        ? allParties.filter(p => visiblePartyIds(visible).has(p.id))
        : allParties;
      let users = [];
      if (auth.record.isOwner || level === 'full') {
        const raw = await kv('HGETALL', 'access');
        for (let i = 0; i < (raw || []).length; i += 2) {
          const rec = JSON.parse(raw[i + 1]);
          if (rec.status === 'approved') users.push({ id: raw[i], name: rec.name || ('id ' + raw[i]), level: dealsLevelOf(rec) });
        }
      }
      res.status(200).send(JSON.stringify({
        me: { uid, name: auth.record.name || ('id ' + uid), isOwner: !!auth.record.isOwner, level },
        deals: visible, parties, users
      }));
      return;
    }

    if (action === 'getDeal') {
      const raw = await kv('GET', 'deal:' + str(body.id, 40));
      if (!raw) { res.status(400).send(JSON.stringify({ error: 'сделка не найдена' })); return; }
      const deal = JSON.parse(raw);
      if (!canRead(level, deal, uid)) { res.status(403).send(JSON.stringify({ error: 'нет доступа к этой сделке' })); return; }
      const log = await readLog(deal.id);
      res.status(200).send(JSON.stringify({ deal, log, canWrite: canWrite(level, deal, uid) }));
      return;
    }

    if (action === 'saveDeal') {
      const incoming = body.deal || {};
      const id = str(incoming.id, 40);
      let before = null;
      if (id) {
        const raw = await kv('GET', 'deal:' + id);
        if (!raw) { res.status(400).send(JSON.stringify({ error: 'сделка не найдена' })); return; }
        before = JSON.parse(raw);
        if (!canWrite(level, before, uid)) { res.status(403).send(JSON.stringify({ error: 'эту сделку вам править нельзя' })); return; }
      }

      const type = oneOf(incoming.type, DEAL_TYPES) || (before && before.type);
      if (!type) { res.status(400).send(JSON.stringify({ error: 'не указан тип сделки' })); return; }

      const deal = {
        id: id || newId(),
        // Технический номер выдаётся один раз при создании (BA-год-NNNN,
        // уникален, используется в CSV/логе) — но владелец может его
        // поправить руками (например, опечатку), если явно прислал новое
        // значение; если поле просто отсутствует/пустое, старое сохраняется.
        num: (incoming.num != null && str(incoming.num, 60).trim()) ? str(incoming.num, 60).trim() : (before ? before.num : await nextDealNumber()),
        // "№ договора"/"дата договора" — отдельные от технического номера
        // поля, целиком ручной ввод, владелец сам решает, что туда писать.
        dealNum: str(incoming.dealNum, 60),
        dealDate: str(incoming.dealDate, 40),
        type: before ? before.type : type,
        route: oneOf(incoming.route, ROUTES) || '',
        sanctioned: !!incoming.sanctioned,
        partyId: str(incoming.partyId, 40),
        partyName: str(incoming.partyName, 200),
        partyKind: oneOf(incoming.partyKind, PARTY_KINDS) || '',
        // Наследие первой версии раздела, когда сделка заводилась на дилера и
        // конечного покупателя указывали отдельно. Сейчас сделка всегда на
        // физике (partyId), интерфейса для этого поля нет; сохраняем то, что
        // уже лежит в записи, чтобы старые сделки не потеряли данные, а с
        // клиента не принимаем.
        endBuyerId: before ? str(before.endBuyerId, 40) : '',
        endBuyerName: before ? str(before.endBuyerName, 200) : '',
        responsible: {
          uid: str((incoming.responsible || {}).uid, 40),
          name: str((incoming.responsible || {}).name, 200)
        },
        car: str(incoming.car, 300),
        year: str(incoming.year, 40),
        budget: str(incoming.budget, 60),
        wishes: str(incoming.wishes, 2000),
        deliveryCity: str(incoming.deliveryCity, 120),
        notes: str(incoming.notes, 4000),
        stages: (incoming.stages && typeof incoming.stages === 'object') ? incoming.stages : (before ? before.stages : {}),
        // Снимок расчёта, а не только его id: история калькулятора общая и
        // ограничена по длине — старые записи из неё выпадают, и одна голая
        // ссылка со временем указывала бы в пустоту. Id храним тоже, чтобы
        // при случае найти живой расчёт в истории. form — параметры расчёта
        // (не только итог), чтобы забронированный расчёт можно было потом
        // пересчитать по свежим курсам. booked — какой из привязанных
        // расчётов реально едет на импорт по этой сделке (не больше одного).
        calcs: Array.isArray(incoming.calcs) ? incoming.calcs.slice(0, 50).map(x => {
          let form = null;
          if (x && x.form && typeof x.form === 'object') {
            try {
              const s = JSON.stringify(x.form);
              if (s.length <= 4000) form = JSON.parse(s);
            } catch (e) { /* битая форма — просто не сохраняем её, остальной расчёт не теряем */ }
          }
          return {
            id: str(x && x.id, 40),
            model: str(x && x.model, 200),
            route: str(x && x.route, 20),
            total: Number(x && x.total) || 0,
            at: Number(x && x.at) || 0,
            booked: !!(x && x.booked),
            form,
            // parts — разбивка наших денег (брокер / агент / доставка по РФ)
            // в рублях, посчитанная калькулятором. Нужна блоку «Деньги»:
            // доставку по городу в deals.html пересчитать нечем — конфиг и
            // deliveryPrice живут только в index.html. У старых снимков
            // parts нет, там разбивка восстанавливается из формы.
            parts: (x && x.parts && typeof x.parts === 'object') ? {
              broker: Number(x.parts.broker) || 0,
              agent: Number(x.parts.agent) || 0,
              delivery: Number(x.parts.delivery) || 0
            } : null,
            // ratesLock — курсы инвойса, зафиксированные оплатой инвойса;
            // frozenAt — момент, после которого расчёт не меняется (таможня
            // оплачена). Оба ставит и снимает клиент отметками этапов, сервер
            // хранит как есть (см. ТЗ 04 и recalcDealCalc ниже).
            ratesLock: cleanRatesLock(x && x.ratesLock),
            frozenAt: Number(x && x.frozenAt) || 0
          };
        }) : (before ? (before.calcs || []) : []),
        problem: {
          on: !!(incoming.problem && incoming.problem.on),
          reason: str((incoming.problem || {}).reason, 500)
        },
        // Клиент считает эти три по своему перечню этапов — сервер их только
        // хранит для списка (см. комментарий в шапке файла).
        stageKey: str(incoming.stageKey, 60),
        stageState: str(incoming.stageState, 10),
        stageAt: Number(incoming.stageAt) || 0,
        archived: !!incoming.archived,
        createdAt: before ? before.createdAt : Date.now(),
        createdBy: before ? before.createdBy : uid,
        updatedAt: Date.now(),
        updatedBy: uid
      };
      // Ответственного назначает владелец; остальные при создании забирают
      // сделку на себя и переназначить её не могут.
      if (!auth.record.isOwner && level !== 'full') {
        deal.responsible = before ? before.responsible : { uid, name: auth.record.name || ('id ' + uid) };
      }
      if (!deal.responsible.uid && !deal.responsible.name && !before) {
        deal.responsible = { uid, name: auth.record.name || ('id ' + uid) };
      }

      await kv('SET', 'deal:' + deal.id, JSON.stringify(deal));
      await kv('HSET', 'deals:idx', deal.id, JSON.stringify(dealIndexRow(deal)));

      const changes = describeChanges(before, deal);
      for (const text of changes.slice(0, 12)) await appendLog(deal.id, auth, text);

      res.status(200).send(JSON.stringify({ deal, log: await readLog(deal.id) }));
      return;
    }

    // Удаление — безвозвратное и полное: сама запись, её лог и строка в
    // индексе. Архив хранит ТОЛЬКО успешно завершённые сделки (последний
    // этап отмечен пройденным) — удалённой сделки не остаётся нигде, это
    // не «скрыть», а «стереть». Права — те же, что на правку сделки.
    if (action === 'removeDeal') {
      const id = str(body.id, 40);
      const raw = await kv('GET', 'deal:' + id);
      if (!raw) { res.status(400).send(JSON.stringify({ error: 'сделка не найдена' })); return; }
      const deal = JSON.parse(raw);
      if (!canWrite(level, deal, uid)) { res.status(403).send(JSON.stringify({ error: 'эту сделку вам удалять нельзя' })); return; }

      await kv('DEL', 'deal:' + id);
      await kv('DEL', 'deal:' + id + ':log');
      await kv('HDEL', 'deals:idx', id);

      // Физик живёт внутри сделки: если удалённая была его последней, его
      // запись уходит следом. Иначе по тому же телефону при заведении новой
      // сделки всплывало бы предупреждение о дубле от сделки, которой уже
      // нет. Проверяем обоих физиков сделки — основного (partyId) и
      // конечного покупателя (endBuyerId): второй точно так же существует
      // только через сделку. Дилеров это не касается — они метки и живут
      // сами по себе.
      const candidates = [...new Set([str(deal.partyId, 40), str(deal.endBuyerId, 40)].filter(Boolean))];
      if (candidates.length) {
        const left = await readHash('deals:idx');
        for (const orphanId of candidates) {
          const stillUsed = left.some(d => d.partyId === orphanId || d.endBuyerId === orphanId);
          if (stillUsed) continue;
          const praw = await kv('GET', 'party:' + orphanId);
          if (!praw) continue;
          const party = JSON.parse(praw);
          if (party.kind !== 'person') continue;
          const phone = normPhone(party.phone);
          if (phone) await kv('HDEL', 'parties:phone', phone);
          await kv('DEL', 'party:' + orphanId);
          await kv('HDEL', 'parties:idx', orphanId);
        }
      }
      res.status(200).send(JSON.stringify({ ok: true }));
      return;
    }

    // Пересчёт забронированного расчёта — вызывается и из deals.html
    // (автопересчёт по этапам, ТЗ 04), и из index.html («Сохранить в сделку
    // и отправить»), поэтому патчит только сам calcs[i], а не весь объект
    // сделки: у калькулятора нет остальных полей сделки под рукой, а
    // обычный saveDeal затёр бы их пустыми значениями.
    // mode: 'full' (по умолчанию) — пересчитан весь расчёт, в лог идёт дата
    // курсов; 'customs' — пересчитаны только таможенные платежи, инвойс по
    // зафиксированному курсу. ratesLock принимается, только если пришёл
    // (ставится при оплате инвойса), иначе остаётся прежний.
    if (action === 'recalcDealCalc') {
      const id = str(body.dealId, 40);
      const calcId = str(body.calcId, 40);
      const raw = await kv('GET', 'deal:' + id);
      if (!raw) { res.status(400).send(JSON.stringify({ error: 'сделка не найдена' })); return; }
      const deal = JSON.parse(raw);
      if (!canWrite(level, deal, uid)) { res.status(403).send(JSON.stringify({ error: 'эту сделку вам править нельзя' })); return; }
      const calcs = Array.isArray(deal.calcs) ? deal.calcs.slice() : [];
      const idx = calcs.findIndex(x => x.id === calcId);
      if (idx === -1) { res.status(400).send(JSON.stringify({ error: 'расчёт не найден в сделке — возможно, его уже отвязали' })); return; }
      // Таможня оплачена — расчёт заморожен, никаких пересчётов, пока
      // отметку «Таможня / Лаборатория — пройден» не снимут.
      if (calcs[idx].frozenAt) { res.status(409).send(JSON.stringify({ error: 'расчёт зафиксирован после оплаты таможни' })); return; }
      const total = Number(body.total);
      if (!isFinite(total)) { res.status(400).send(JSON.stringify({ error: 'некорректная сумма пересчёта' })); return; }
      let form = calcs[idx].form;
      if (body.form && typeof body.form === 'object') {
        try { const s = JSON.stringify(body.form); if (s.length <= 4000) form = JSON.parse(s); } catch (e) { /* оставляем прежнюю форму */ }
      }
      const parts = (body.parts && typeof body.parts === 'object') ? {
        broker: Number(body.parts.broker) || 0,
        agent: Number(body.parts.agent) || 0,
        delivery: Number(body.parts.delivery) || 0
      } : (calcs[idx].parts || null);
      const mode = body.mode === 'customs' ? 'customs' : 'full';
      const patch = { total, form, parts, at: Date.now() };
      if (body.ratesLock && typeof body.ratesLock === 'object') patch.ratesLock = cleanRatesLock(body.ratesLock);
      calcs[idx] = Object.assign({}, calcs[idx], patch);
      deal.calcs = calcs;
      deal.updatedAt = Date.now();
      deal.updatedBy = uid;
      await kv('SET', 'deal:' + id, JSON.stringify(deal));
      await kv('HSET', 'deals:idx', id, JSON.stringify(dealIndexRow(deal)));
      const name = str(calcs[idx].model || 'без названия', 60);
      if (mode === 'customs') {
        await appendLog(id, auth, 'пересчитал таможню в расчёте «' + name + '»: ' + Math.round(total) + ' ₽');
      } else {
        const ratesDate = /^\d{2}\.\d{2}\.\d{4}$/.test(String(body.ratesDate || ''))
          ? String(body.ratesDate)
          : ddMmYyyy(calcs[idx].ratesLock && calcs[idx].ratesLock.at ? calcs[idx].ratesLock.at : Date.now());
        await appendLog(id, auth, 'пересчитал расчёт «' + name + '»: ' + Math.round(total) + ' ₽ (курсы на ' + ratesDate + ')');
      }
      res.status(200).send(JSON.stringify({ ok: true, total }));
      return;
    }

    if (action === 'getParty') {
      const pid = str(body.id, 40);
      const raw = await kv('GET', 'party:' + pid);
      if (!raw) { res.status(400).send(JSON.stringify({ error: 'контрагент не найден' })); return; }
      const party = JSON.parse(raw);
      const [allDeals, allParties] = await Promise.all([readHash('deals:idx'), readHash('parties:idx')]);
      const linkedDeals = allDeals.filter(d => (d.partyId === pid || d.endBuyerId === pid) && canRead(level, d, uid));
      // 'own' — доступ только к контрагентам своих сделок (см. visiblePartyIds
      // выше); linkedDeals уже отфильтрован по canRead, так что пустой список
      // здесь и значит "не связан ни с одной видимой мне сделкой".
      if (level === 'own' && !auth.record.isOwner && !linkedDeals.length) {
        res.status(403).send(JSON.stringify({ error: 'нет доступа к этому контрагенту' }));
        return;
      }
      res.status(200).send(JSON.stringify({
        party,
        deals: linkedDeals,
        // Частники, которых привёл этот дилер.
        linked: party.kind === 'dealer' ? allParties.filter(p => p.dealerId === pid) : []
      }));
      return;
    }

    if (action === 'saveParty') {
      const incoming = body.party || {};
      const pid = str(incoming.id, 40);
      let before = null;
      if (pid) {
        const raw = await kv('GET', 'party:' + pid);
        if (raw) before = JSON.parse(raw);
      }
      // Правка СУЩЕСТВУЮЩЕГО контрагента — только владелец и full (ЗАДАНИЕ.md
      // Блок 9). Создание нового остаётся открытым любому с доступом к
      // разделу — иначе на "своей" сделке нельзя завести нового клиента.
      if (before && !auth.record.isOwner && level !== 'full') {
        res.status(403).send(JSON.stringify({ error: 'редактировать существующих контрагентов может только владелец или пользователь с полным доступом' }));
        return;
      }
      const kind = oneOf(incoming.kind, PARTY_KINDS) || (before && before.kind) || 'person';
      const party = {
        id: pid || newId(),
        kind,
        name: str(incoming.name, 200),
        phone: str(incoming.phone, 60),
        notes: str(incoming.notes, 2000),
        // Карточка дилера намеренно короткая — имя, телефон, ник в Telegram,
        // и всё; у частника вместо этого — канал связи/город/кто привёл и
        // опциональные паспортные данные для договора.
        telegramUsername: kind === 'dealer' ? str(incoming.telegramUsername, 60).replace(/^@/, '') : '',
        channel: kind === 'person' ? str(incoming.channel, 60) : '',
        city: kind === 'person' ? str(incoming.city, 120) : '',
        dealerId: kind === 'person' ? str(incoming.dealerId, 40) : '',
        gender: kind === 'person' ? oneOf(incoming.gender, ['m', 'f']) || '' : '',
        birthDate: kind === 'person' ? str(incoming.birthDate, 20) : '',
        passportSeries: kind === 'person' ? str(incoming.passportSeries, 4) : '',
        passportNumber: kind === 'person' ? str(incoming.passportNumber, 6) : '',
        passportIssuedBy: kind === 'person' ? str(incoming.passportIssuedBy, 300) : '',
        passportIssuedDate: kind === 'person' ? str(incoming.passportIssuedDate, 20) : '',
        divisionCode: kind === 'person' ? str(incoming.divisionCode, 7) : '',
        registrationAddress: kind === 'person' ? str(incoming.registrationAddress, 300) : '',
        inn: kind === 'person' ? str(incoming.inn, 12) : '',
        snils: kind === 'person' ? str(incoming.snils, 14) : '',
        createdAt: before ? before.createdAt : Date.now(),
        updatedAt: Date.now()
      };
      if (!party.name) { res.status(400).send(JSON.stringify({ error: 'у контрагента должно быть имя' })); return; }

      await kv('SET', 'party:' + party.id, JSON.stringify(party));
      await kv('HSET', 'parties:idx', party.id, JSON.stringify(partyIndexRow(party)));

      const phoneNow = normPhone(party.phone);
      const phoneWas = before ? normPhone(before.phone) : '';
      if (phoneWas && phoneWas !== phoneNow) await kv('HDEL', 'parties:phone', phoneWas);
      if (phoneNow) await kv('HSET', 'parties:phone', phoneNow, party.id);

      res.status(200).send(JSON.stringify({ party }));
      return;
    }

    // Поиск по телефону при создании сделки: полное совпадение отдаём сразу,
    // а решение "тот же это человек или новый" принимает пользователь на
    // экране — сервер лишь сообщает, что нашёл.
    if (action === 'findPartyByPhone') {
      const phone = normPhone(body.phone);
      if (!phone) { res.status(200).send(JSON.stringify({ party: null })); return; }
      const pid = await kv('HGET', 'parties:phone', phone);
      if (!pid) { res.status(200).send(JSON.stringify({ party: null })); return; }
      const raw = await kv('GET', 'party:' + pid);
      if (!raw) { res.status(200).send(JSON.stringify({ party: null })); return; }
      const party = JSON.parse(raw);
      // Без прав на запись (ЗАДАНИЕ.md Блок 9) — не отдаём телефон/заметки/
      // условия работы дилера, только то, что реально нужно интерфейсу
      // "это тот же человек?" и созданию сделки на него: id/имя/тип/город.
      // Именно терминов работы дилера ("условия работы") касалось задание —
      // не id, без которого сделку было бы не на кого оформить.
      const party_ = (auth.record.isOwner || level === 'full')
        ? party
        : { id: party.id, name: party.name, kind: party.kind, city: party.city, found: true };
      res.status(200).send(JSON.stringify({ party: party_ }));
      return;
    }

    if (action === 'deleteParty') {
      if (!auth.record.isOwner) { res.status(403).send(JSON.stringify({ error: 'удалять контрагентов может только владелец' })); return; }
      const pid = str(body.id, 40);
      const raw = await kv('GET', 'party:' + pid);
      if (raw) {
        const party = JSON.parse(raw);
        const phone = normPhone(party.phone);
        if (phone) await kv('HDEL', 'parties:phone', phone);
      }
      await kv('DEL', 'party:' + pid);
      await kv('HDEL', 'parties:idx', pid);
      res.status(200).send(JSON.stringify({ ok: true }));
      return;
    }

    // Выгрузка — полные записи со всеми этапами и логом. Файлы собирает
    // клиент (ему же их и отдавать пользователю), сервер отдаёт данные.
    if (action === 'export') {
      if (level !== 'full') { res.status(403).send(JSON.stringify({ error: 'выгрузка доступна при полном уровне доступа' })); return; }
      const [dealIdx, partyIdx] = await Promise.all([readHash('deals:idx'), readHash('parties:idx')]);
      const deals = [];
      for (const row of dealIdx) {
        const raw = await kv('GET', 'deal:' + row.id);
        if (!raw) continue;
        const deal = JSON.parse(raw);
        deal.log = await readLog(deal.id);
        deals.push(deal);
      }
      const parties = [];
      for (const row of partyIdx) {
        const raw = await kv('GET', 'party:' + row.id);
        if (raw) parties.push(JSON.parse(raw));
      }
      res.status(200).send(JSON.stringify({ exportedAt: Date.now(), deals, parties }));
      return;
    }

    res.status(400).send(JSON.stringify({ error: 'неизвестное действие' }));
  } catch (e) {
    console.error('api/deals error:', e);
    res.status(500).send(JSON.stringify({ error: e.message || String(e) }));
  }
};

module.exports.LEVELS = LEVELS;
