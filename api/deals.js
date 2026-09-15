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
    type: deal.type,
    route: deal.route,
    partyId: deal.partyId || '',
    partyName: deal.partyName || '',
    partyKind: deal.partyKind || '',
    car: deal.car || '',
    stageKey: deal.stageKey || '',
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
    dealerId: party.dealerId || ''
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
    ['partyName', 'контрагент'], ['endBuyerName', 'конечный покупатель'],
    ['route', 'маршрут'], ['car', 'что ищем'], ['deliveryCity', 'город доставки'],
    ['notes', 'заметки'], ['budget', 'бюджет'], ['wishes', 'пожелания'], ['year', 'год']
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
      const word = a.state === 'done' ? 'пройден' : (a.state === 'skip' ? 'не требуется' : 'снят');
      out.push('этап «' + str(a.label || key, 60) + '» — ' + word);
    } else if (str(b.note) !== str(a.note)) {
      out.push('заметка к этапу «' + str(a.label || key, 60) + '»');
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
      const visible = deals.filter(d => canRead(level, d, uid));
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
      if (!canRead(level, deal, uid)) { res.status(400).send(JSON.stringify({ error: 'нет доступа к этой сделке' })); return; }
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
        if (!canWrite(level, before, uid)) { res.status(400).send(JSON.stringify({ error: 'эту сделку вам править нельзя' })); return; }
      }

      const type = oneOf(incoming.type, DEAL_TYPES) || (before && before.type);
      if (!type) { res.status(400).send(JSON.stringify({ error: 'не указан тип сделки' })); return; }

      const deal = {
        id: id || newId(),
        // Номер выдаётся один раз при создании и дальше неизменен, что бы ни
        // прислал клиент: по нему сделку ищут в переписке и документах.
        num: before ? before.num : await nextDealNumber(),
        type: before ? before.type : type,
        route: oneOf(incoming.route, ROUTES) || '',
        partyId: str(incoming.partyId, 40),
        partyName: str(incoming.partyName, 200),
        partyKind: oneOf(incoming.partyKind, PARTY_KINDS) || '',
        endBuyerId: str(incoming.endBuyerId, 40),
        endBuyerName: str(incoming.endBuyerName, 200),
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
        // при случае найти живой расчёт в истории.
        calcs: Array.isArray(incoming.calcs) ? incoming.calcs.slice(0, 50).map(x => ({
          id: str(x && x.id, 40),
          model: str(x && x.model, 200),
          route: str(x && x.route, 20),
          total: Number(x && x.total) || 0,
          at: Number(x && x.at) || 0
        })) : (before ? (before.calcs || []) : []),
        problem: {
          on: !!(incoming.problem && incoming.problem.on),
          reason: str((incoming.problem || {}).reason, 500)
        },
        // Клиент считает эти три по своему перечню этапов — сервер их только
        // хранит для списка (см. комментарий в шапке файла).
        stageKey: str(incoming.stageKey, 60),
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
        res.status(400).send(JSON.stringify({ error: 'нет доступа к этому контрагенту' }));
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
        res.status(400).send(JSON.stringify({ error: 'редактировать существующих контрагентов может только владелец или пользователь с полным доступом' }));
        return;
      }
      const kind = oneOf(incoming.kind, PARTY_KINDS) || (before && before.kind) || 'person';
      const party = {
        id: pid || newId(),
        kind,
        name: str(incoming.name, 200),
        phone: str(incoming.phone, 60),
        channel: str(incoming.channel, 60),
        city: str(incoming.city, 120),
        notes: str(incoming.notes, 2000),
        // Только у дилера — условия работы; только у частника — кто его привёл.
        terms: kind === 'dealer' ? str(incoming.terms, 2000) : '',
        dealerId: kind === 'person' ? str(incoming.dealerId, 40) : '',
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
      if (!auth.record.isOwner) { res.status(400).send(JSON.stringify({ error: 'удалять контрагентов может только владелец' })); return; }
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
      if (level !== 'full') { res.status(400).send(JSON.stringify({ error: 'выгрузка доступна при полном уровне доступа' })); return; }
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
