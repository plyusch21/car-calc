# car-calc — Baikal Auto import-cost calculator

## What this is

A Telegram Mini App used internally by **Baikal Auto** (a Russian car-import
business) to calculate the full landed cost of importing a car into Russia
from Japan, Korea, China, or via the EAEU (Kyrgyzstan) customs route, and to
send a client-facing quote (text + a branded commercial-offer image) via
WhatsApp, Telegram, or MAX.

- Live app: https://car-calc-eight.vercel.app (opens only inside Telegram —
  see the access-gate note below)
- Repo: `plyusch21/car-calc` on GitHub, auto-deployed to Vercel on push to `main`
- Owner/operator: the person who opens this app inside Telegram; there's a
  simple approval system (see Access below) for other staff

## Как читать этот код, не сжигая контекст

`index.html` (195 КБ, ~55 000 токенов) и `deals.html` (80 КБ, ~22 000
токенов) — самые крупные файлы в репозитории, и оба слишком большие, чтобы
читать целиком при каждой мелкой правке. Вместо этого:

- Смотреть `.claude/map.md` — карту строк обоих файлов (пронумерованные
  секции + все функции, каждая с диапазоном строк).
- Читать нужный диапазон через `sed -n 'START,ENDp' файл`, а не файл
  целиком.
- Искать конкретное имя/строку через `grep -n`.
- Править точечно (`Edit`), не переписывая файл заново.
- После любой правки, сдвигающей нумерацию строк в этих двух файлах,
  перегенерировать карту: `bash tools/mapgen.sh`.

## Architecture

Deliberately a **single-file vanilla-JS app** (`index.html`) + a handful of
Vercel serverless functions under `api/`. No build step, no framework, no
bundler. Keep it that way — don't introduce React/Vue/a bundler/npm deps
unless explicitly asked; the whole point is that it's one file you can read
top to bottom.

- `lib/calc.js` — the calculation formula and everything it needs
  (`DEFAULT_CONFIG`, the stored-config merge, `calcDeal`, `deliveryPrice`,
  `convertToRub`, the TKS request body `customsPayload`, and
  `customsAutoTotal`), exposed as one global `BkCalc` and loaded by a plain
  `<script src="/lib/calc.js?v=N">` in both `index.html` and `deals.html`
  (no modules, no bundler). Functions never read the global `CONFIG` — the
  config is always an argument; `index.html` keeps thin wrappers with the
  old names (`calcDeal(route,f)` etc.). Bump `?v=N` in both html files
  whenever this file changes. Regression check: `node tools/calc-check.js`
  must print the reference output recorded in `tools/calc-fixture.md`.
  `node tools/calc-check.js` — основной способ; браузерный стенд — только
  если Node недоступен.
- `index.html` — everything else: markup skeleton, all CSS, all client JS. Organized
  in numbered sections (search for `/* ---... N. ... ---... */` comment
  headers) — config, currency rates, customs calc, rendering, history,
  settings, KP-image builder, sharing, Telegram auth/gate, boot.
- `api/rates.js` — currency rate fetching (CNY/JPY/KRW/USDT/EUR), each with
  its own source (see `DEFAULT_CONFIG.rates` in index.html for exact source
  URLs/notes per currency) and a pinned Russian root CA for sources that need it.
- `api/customs.js` — customs duty/util-fee calc via TKS.RU official API
  (primary) with alta.ru fallback, rate-limited to 1 req/sec via Redis.
- `api/parse-listing.js` — "smart autofill": extracts structured car data from
  pasted listing text or a Japanese auction-sheet photo. **Gemini is the
  primary provider** (since Sept 2026 — earlier it was geo-blocked from
  Russia, GigaChat was primary then; that's since become usable, key is
  `GEMINI_API_KEY`/`GEMINI_MODEL` env vars), **GigaChat (Sber) is the
  automatic fallback** on any Gemini error, and a no-AI regex fallback
  (`heuristicParse`) exists for the text path only if both AI providers fail.
  For the **Korea route**, pasting an encar.com listing URL into the same box
  instead of text skips AI entirely for the structured fields: it fetches
  `api.encar.com/v1/readside/vehicle/<id>` (the same JSON the site's own SPA
  uses to hydrate — NOT the HTML page, which serves an empty client-rendered
  shell to cloud/datacenter IPs including Vercel's, confirmed by live testing;
  scraping `__PRELOADED_STATE__` out of the HTML only works from a residential
  IP) and maps `category`/`spec`/`advertisement` deterministically. AI is only
  used on the short `advertisement.oneLineText` seller blurb (if present) to
  fill `condition`/`notes` — the merge logic gives structured fields priority
  but must skip `null` structured keys or it silently wipes out whatever the
  AI found (a real bug caught by live-testing a listing that had a blurb;
  fixed in `parseEncarListing()`).
- `api/auth.js`, `api/admin.js`, `api/state.js` — Telegram `initData`
  verification (`api/_lib/telegram.js`), the access-approval system
  (`api/_lib/access.js`), and cross-device config/history sync via KV.
- `api/share-relay.js` — short-lived (10 min, one-time-read) KV-backed
  handoff used only by the Android "no Web Share API inside Telegram's
  WebView" workaround (see Sharing below).
- `api/_lib/kv.js` — minimal Upstash Redis REST client (`KV_REST_API_URL`/
  `KV_REST_API_TOKEN`, auto-injected by Vercel once a KV store is attached).
- `diag.html` / `share.html` — standalone pages (no Telegram auth, registered
  as extra static routes in `vercel.json`) — see Sharing below.

### Config sync vs. code authority (important recurring pattern)

`CONFIG.routes` and `CONFIG.rates` are partly user-editable (via Settings)
and synced across devices through `/api/state`. Early on this caused a real
bug class: a stale synced blob would silently override code fixes for
returning users, because the whole objects were being merged wholesale.
Fixed via `mergeRatesState()` / `mergeRoutesState()`: **only the genuinely
user-editable fields** (rate `adjustment`/`manualOverride`/etc.,
`brokerFee`/`agentFee`/`bankCommissionPct`) persist from synced storage;
everything else (labels, dutyMode, defaultExtraCosts, source URLs, ...)
always comes fresh from `DEFAULT_CONFIG` in code. **If you add a new field
to `DEFAULT_CONFIG.routes`/`.rates`, decide deliberately whether it belongs
in the merge whitelist — the default should be "no, comes from code."**

### Access

Telegram `initData` is the only trust signal — verified server-side
(`verifyInitData` in `api/_lib/telegram.js`), never trust `initDataUnsafe`
client-side data for access decisions. First person ever to open the app
becomes the owner automatically; everyone else needs owner approval
(Settings → Доступ к приложению). The app refuses to render at all without
valid `initData` — see the gate in `index.html` (search "Доступ через
Telegram" in `renderGate`) — this is also why `diag.html`/`share.html`
exist as separate ungated static pages (see below).

## The calculation

`calcDeal(route, f)` is the core — returns `invoiceRub`, `customsTotal`,
`broker`, `agent`, `delivery`, `total`, plus native-currency figures used by
the client-facing text/image. Routes: `china`, `japan`, `korea`, `eaeu`.
EAEU is always shown to the **client** as "Китай" (same underlying Chinese
car, EAEU/Kyrgyzstan is our customs routing, not something the client needs
to know) — this rule shows up in several places (share text, KP image
header, city genitive fallback) — grep `eaeu.*Китай` if extending it.

## Sharing a quote to the client (`shareResult` in index.html)

**One button, one behaviour, every device and every messenger.** The single
tri-colour "Отправить в мессенджер" button (green→blue→purple gradient, the
old WhatsApp/Telegram/MAX colours merged into one control) does exactly two
things, in this order:

1. copies the quote **text** to the clipboard (`navigator.clipboard.writeText`,
   inside the click so platforms that gate clipboard writes on a user gesture
   allow it);
2. shares **only the PNG** — `navigator.share({files:[file]})`, with **no
   `text` and no `title`**.

The owner then pastes the text next to the photo in whichever messenger he
picked. This is a deliberate product decision (Sept 2026), not a workaround:
it was the only behaviour that is identical on all three of his devices
(iPhone / Honor 200 Lite / MacBook Air) across Telegram, WhatsApp and MAX.

**Why `text` and `title` are never passed to `navigator.share`:** WhatsApp on
iOS cannot accept a file and text in one share, and it treats even `title` as
message text — so any of those fields re-creates the exact combination it
rejects. What used to be an iOS-WhatsApp-only special case is now the common
path; **there is no per-platform or per-messenger branch in `shareResult` any
more, and adding one back would undo the decision above.**

`shareResult` returns `true` when the share actually happened and `false`
when the user cancelled (`AbortError`) or the image couldn't be prepared.
**The caller clears the form only on `true`** — previously a cancelled share
looked identical to a successful one and silently wiped the entered data.

**Fallback chain, in order (all photo-only, all keeping the text in the
clipboard):**
- **`navigator.share` missing** — happens in Telegram's Android Mini App
  WebView (confirmed on the owner's device; plain Chrome on the same phone
  has the full Share API). Not fixable in our JS. Routed through
  `Telegram.WebApp.openLink()` to `share.html?id=...` in the real external
  browser, with the rendered image handed over via the short-lived
  `api/share-relay.js` KV store (a blob in one app's memory can't cross to
  another). One extra tap there is unavoidable: the Web Share API needs a
  fresh gesture in the page that calls it. If Telegram ever ships a fix,
  this branch simply stops being reached — it is self-obsoleting.
- **Everything else failed** — a bottom sheet showing the image for
  long-press save/share.
- **Do not** call `navigator.share` a second time after a failure inside the
  Mini App: that retry pattern was tried once and actively broke WhatsApp by
  interrupting an in-flight share.

`diag.html` (`/diag`) is a standalone page for testing
`navigator.share`/`canShare`/`clipboard`/download capability outside the
Mini App gate — walk the reporter through it before guessing at fixes.

## The KP (commercial-offer) image

`buildKpHtml(route, f, r)` renders a fixed-design HTML card (logo, header,
3 stat boxes, numbered payment breakdown, ИТОГО bar, optional insurance
note, optional car-parameters table, footer) in the "Cobalt" design,
matching the approved mockup `ТЗ/14-макет-фото-кп.html` (assembly D1). The
logo is `logo-kp.png` — white lettering on a transparent background, for
the dark gradient hero; the old `logo.png` (blue baked-in backdrop) stays
in the repo untouched, and the owner may later drop a designer original in
under the `logo-kp.png` name without a code change. Smallest type on the
card is 17 px on purpose: messengers halve the width of a 1080 px image,
and 14 px stopped being readable after that. `renderKpImageBlob` turns it
into a JPEG (quality 0.92 — a 5–8 MB PNG gets recompressed far harder by
Telegram than a ~1 MB JPEG) via html2canvas at a scale chosen to stay under
mobile WebView canvas limits (~16M px area / ~4096px per side — a fixed high scale used to
silently fail the whole render on real phones with long receipts).
"Параметры автомобиля" section only appears when `f.showCarDetails` is on
(same show/hide rule as the text message); individual fields inside show
"—" when empty since it's a fixed table layout, not freely-omittable lines
like the text version.

## Deal tracking (`deals.html` + `api/deals.js`)

A second Mini App page (not a tab in `index.html` — that file is already
large) for tracking in-progress car deals: counterparties, deals, stage
checklists, a change log, and an export. Entry point is the bottom nav
(leftmost item, "Сделки") in both `index.html` and `deals.html` — plain
navigation to `/deals`, same Mini App window, same `initData`, so the
Telegram gate behaves identically to the calculator. Unlike `diag.html`/
`share.html`, this page is gated — it's real business data, not a
diagnostic tool.

### Storage: one KV key per record, not a shared blob

Several people use this at once. `state:config`/`state:history` (the
calculator's sync) can get away with one blob per user because it's
single-player; deals can't — two people editing different deals at the same
time would have the second save silently erase the first's. So every deal
and every counterparty (`party`) is its own KV key (`deal:<id>`,
`party:<id>`), with light HASH indexes (`deals:idx`, `parties:idx`) backing
the list screens so they don't fetch every full record. Per-deal change log
is a LIST (`RPUSH`), which is naturally append-safe under concurrent writes
the way a read-modify-write on a blob wouldn't be. See the doc comment at
the top of `api/deals.js` for the full key schema before changing it.

### Stage templates live in client code only

`STAGE_TEMPLATES` in `deals.html` — two fixed lists (`import`, `paperwork`),
picked once at deal creation and never changed after. The server
(`api/deals.js`) deliberately has no idea what the stages are; a deal record
only stores marks (`{state, at, note}` keyed by stage key) plus three
derived fields the client computes and sends along purely for the list
screen (`stageKey`, `stageState`, `stageAt`, `archived`). This is the same pattern as the
`DEFAULT_CONFIG` whitelist rule above, for the same reason: if the template
lived in synced/stored data, it would either fork per-record or need a
migration every time a stage is renamed. **If you touch the stage list,
only edit `STAGE_TEMPLATES` in `deals.html`.**

Deal status is never stored or set by hand — `currentStage()` derives it as
the furthest stage marked `done` or `wip` ("в процессе" — the deal has
reached that stage, it just isn't closed yet), so it can't drift from the
marks themselves. The optional `shipping` stage has one more state (`skip`,
"не требуется") that deliberately doesn't count toward status. Marking a
stage in the middle of the list as `wip` or `done` auto-marks every earlier
stage that is unmarked **or `wip`** as `done` — unmarked ones get `at: 0` and
no note (a date there would be invented, and the blank is what shows it was
closed retroactively), former `wip` ones keep their date and note; `done`
and `skip` are never overwritten. The reverse also holds (ТЗ 07): lowering a
stage's rank (`''`=0, `wip`=1, `done`/`skip`=2) deletes every mark after it,
money amounts included, and the stage sheet warns about it beforehand.
Import's second stage is one merged «Договор / Предоплата» under the old
key `contract` (the old `prepay` stage is gone; `migrateStages()` folds
`stages.prepay` and `stages.booking.amount` into `contract` on first touch —
no server-side migration). Marking the template's
`final` stage (`issued`, "выдан авто") archives the deal automatically.

Deleting a deal is permanent and complete (`removeDeal` in `api/deals.js`):
record, change log and index row are all wiped, nothing goes to the archive
— the archive holds only deals finished via the `final` stage. Because a
physik exists only through a deal, deleting their last one also deletes
their party record and phone-index entry (checked for both `partyId` and
`endBuyerId` against the remaining deals); dealers are never touched.
Legacy `removed: true` rows from the old soft-delete are filtered out of
`bootstrap`; nothing purges them — there were none left worth a cron slot.

### Access is a second axis, independent of app access

`dealsLevelOf(record)` in `api/_lib/access.js` computes `none` / `own` /
`read_all` / `full` from the same `access` HASH record used for app
approval — there's no separate migration for users approved before this
section existed; missing the field just means `full` (the owner's call when
this shipped), narrowable per-user in Settings → Доступ к приложению. Owner
is hardcoded `full` and can't be changed. Enforcement (`canRead`/
`canWrite` in `api/deals.js`) is server-side per deal, not just hidden in
the UI — "own" means you're the deal's assigned `responsible.uid` or its
creator. `responsible` can also be a free-text name with no `uid` (the
owner explicitly wanted this, for people who aren't app users); such a deal
belongs to nobody's "own" filter, which is correct, not a bug.

### Linking a person under a dealer

A `person`-kind party can carry `dealerId` (the dealer that brought them —
this is the spec's "конечный покупатель"). The only entry point is the
dealer's own party card ("+ Новый конечный покупатель от этого дилера"),
which opens the party sheet pre-filled with `kind:'person', dealerId`; the
generic "+ Новый контрагент" flow also allows picking a dealer manually.
A deal's own `endBuyerId`/`endBuyerName` is a leftover from the first
version of this section, when a deal was opened on a dealer and the end
buyer was picked separately. Deals are now always opened on the physik
(`partyId`), so the field has no UI any more: `saveDeal` keeps whatever an
existing record already holds and ignores it from the client; reads
(`visiblePartyIds`, the orphan check in `removeDeal`, `getParty`'s linked
deals) still honour it so old records behave. Don't resurrect it.

### Linked calculations are snapshots, not live references

A deal's `calcs[]` array copies `{id, model, route, total, at}` out of the
calculator's shared history at link time, read via `/api/state` from
`deals.html`. That history is shared across the whole app and capped in
length, so a bare id would eventually point at nothing once the entry ages
out — the snapshot is what actually renders in the deal card.

### Деньги по сделке — только наши, и только из расчёта

Блок «Деньги» в карточке сделки (`moneyCardHtml` в `deals.html`) показывает
**только то, что получаем мы**: первоначальный взнос, брокерские услуги,
комиссию агента и доставку по РФ. Инвойс и таможенные платежи туда не
выводятся — это не наши деньги (решение владельца, не упущение).

- **Ручного ввода сумм нет.** Источник — расчёт, привязанный к сделке:
  забронированный, а если привязан ровно один, то он (`moneyCalc`).
  Несколько расчётов без брони — источника нет, блок просит забронировать.
- Взнос равен брокерским услугам (так же, как `downPayment = broker` в
  `calcDeal`) и засчитывается в счёт брокера: после него остаются комиссия
  агента и доставка. Взнос **поступает** на «Договор / Предоплата»
  (`contract`), а «Бронь — пройден» его **удерживает** (подпись «удержана»,
  больше не возвращается). У `contract` есть состояние `skip` с подписью
  «без предоплаты» (`skipLabel` в `STAGE_TEMPLATES`) — тогда брокер целиком
  уходит в остаток.
- **Сумма фиксируется отметкой этапа и живёт в ней же**: `stages.contract.amount`
  и `stages.settle.amount` (рубли). Отдельной сущности «платёж» нет —
  платежей ровно два. Сервер отметки этапов хранит как есть, объявлять там
  новые поля не нужно. Зафиксированная сумма не меняется, даже если расчёт
  потом пересчитают; снял отметку — сумма исчезает вместе с ней
  (`fixMoneyAmounts`).
- Разбивка берётся из `calcs[i].parts` (`{broker, agent, delivery}`),
  который кладёт калькулятор при сохранении в историю и при пересчёте.
  У снимков, сделанных до этого, `parts` нет: разбивка восстанавливается из
  формы, но доставку, подобранную по городу, восстановить нечем —
  `deliveryPrice` и таблица цен живут только в `index.html`. Такой остаток
  показывается как «от N ₽» и не фиксируется, пока расчёт не пересчитают.
- Блок только у сделок типа «Импорт» и только у физиков без дилера
  (`moneyApplies`) — дилерам взаиморасчёты не нужны. Понадобится обратное —
  убирается одно условие в `moneyApplies`, остальное не меняется.

### Автопересчёт расчёта по этапам (ТЗ 04)

Снимок расчёта в сделке (`calcs[i]`) проходит три состояния, привязанные к
отметкам этапов — без отдельных нажатий (`recalcBookedCalc` в `deals.html`,
вызывается из обработчика «Сохранить» шита этапа; источник — тот же
`moneyCalc`: забронированный, либо единственный):

- **«Оплата инвойса — пройден»** → полный пересчёт по курсам на дату
  этапа: сегодня — текущие из `state.calcConfig` (тот же `state:config`,
  что у калькулятора, `loadCalcState`), раньше — `action:'getRatesAt'` в
  `api/state.js` (последняя запись `rates:hist:<ID>` не позже конца того
  дня; недостающие — текущие, с пометкой в `missing`). Результат
  фиксируется в `calcs[i].ratesLock = {at, values, source, missing}`.
- **«Таможня / Лаборатория — в процессе»** → пересчёт только таможни
  (ТКС тем же запросом, что из калькулятора), инвойс по `ratesLock.values`
  через четвёртый аргумент `BkCalc.calcDeal`. Ручная таможня
  (`customsOverride`) — пропуск с тостом.
- **«Таможня / Лаборатория — пройден»** → `calcs[i].frozenAt`; сервер на
  `recalcDealCalc` отвечает 409, кнопки и ссылки в карточке нет. Заморозка
  следует за состоянием этапа, а не за тем, какой этап отметили: таможня,
  закрытая каскадом, тоже замораживает; откат — снимает. Если после
  сохранения «Оплата инвойса» не `done` (откат), у источника снимается и
  `ratesLock` — следующая оплата зафиксирует курс заново.

Ошибка ТКС прерывает пересчёт целиком (ничего не сохраняется), в карточке
«требуется пересчёт» (живёт в `state.recalcNeeded`, не в записи). Автозакрытие
предыдущих этапов пересчёт не запускает. Кнопка «пересчитать по курсам»
считает прямо в `deals.html` (режим — по состоянию снимка); «открыть в
калькуляторе» — прежний переход через `bk_recalc_v1`, теперь с `ratesLock`:
`RECALC_CTX.ratesLock` в `index.html` подменяет курсы в `calcDeal` и
виджете курса, редактор при этом не открывается. Общая история расчётов
(`state.history`) пересчётами по-прежнему не трогается.

### Export

Owner/`full`-level only, and it lives in the calculator's Settings
("Сделки — дополнительно" in `index.html`), not in `deals.html`. Three
files in one shot: full JSON, plus deals and parties as CSV (BOM-prefixed
for Excel, quotes/semicolons/newlines in fields properly escaped) — see
`dealsCsvIdx`/`partiesCsvIdx` in `index.html`. The CSV shows raw stage keys
rather than labels on purpose: `STAGE_TEMPLATES` lives only in `deals.html`
and duplicating it here would be one more copy to go stale.
Delivery tries `navigator.share` with files, then `<a download>`, then
falls back to a copyable JSON textarea — same three-tier fallback as the
sharing code below, for the same reason (Telegram's Android WebView has
neither share nor download working).

## Тема оформления (ТЗ 08–09, 13)

Две темы «Кобальт»: тёмная (по умолчанию, значения в `:root`) и светлая
(`:root[data-theme="light"]` плюс правила `[data-theme="light"] …` в конце
`<style>`), одинаково в `index.html` и `deals.html`. Выбор — личная
настройка пользователя: KV `access/<uid>.theme`, `localStorage`
`bk_theme_v1 = {mode:'dark'|'light'|'auto'}` — кэш, чтобы не мигало при
открытии. Не `CONFIG`, «Сбросить настройки» его не трогает. С сервером
тема приходит в ответе `/api/auth` (`theme`) и `bootstrap` (`me.theme`) и
применяется через `BkTheme.sync()`; пустое значение — локальный выбор
(если не тёмная) один раз уходит на сервер. Смена в настройках —
`BkTheme.save()` → `api/state.js` `saveTheme`; ошибка — тост, экран не
откатывается. Автопереключение в режиме `auto` на сервер не пишет. `BkTheme` —
маленький скрипт в `<head>` **до** `<style>` (иначе при открытии мигает
тёмная), копия в обоих файлах; он же красит шапку/фон Telegram в `--bg`
темы (`#070c14` / `#ebebee`) — не вызывать `setHeaderColor` с
захардкоженным цветом. «Как на телефоне» берёт у Telegram только
`colorScheme` (светло/темно), палитра всегда наша. Фото-КП (`.kp-*`) от
темы не зависит. Новый элемент со своим цветом — сразу решить, как он
выглядит в светлой.

## Standing conventions (from the owner, apply without re-asking)

- Respond to the owner in Russian in normal conversation.
- Commit and push after every change, without being asked.
- Once the owner has approved a change (said "да", "делай", or reviewed the
  result and moved on), merge it into `main` yourself — no PR, no asking.
  `main` is what Vercel deploys; a session branch alone never reaches the
  phone, and the owner doesn't want to be asked about branches vs. main.
  Fast-forward when possible so `main` history stays linear.
- Commit messages end with `Co-Authored-By: Claude <модель, которая выполняла ТЗ> <noreply@anthropic.com>`,
  например `Claude Opus 5`.
- Never type/enter secrets into any field — the owner pastes API keys etc.
  themselves; env vars only, never committed into tracked files.
- Never fabricate results for systems this session can't access (e.g. "it
  works on your phone" without a live test — get the owner to test and
  report back, especially for anything share/mobile-related that can't be
  verified from a desktop browser).
- Test UI/frontend changes in the Browser pane before calling them done;
  for the KP image / sharing specifically, the desktop Browser pane can
  verify the code runs and the image renders correctly, but real
  phone+Telegram behavior (especially Web Share API quirks) needs the
  owner's live device — say so explicitly rather than claiming a mobile-only
  behavior is fixed without their confirmation.

## Журнал решений

ТЗ лежат в `ТЗ/`, нумерованы, `00-ПОРЯДОК.md` — очередь; выполненные не удалять.

Когда владелец в ходе сессии меняет ранее согласованное, отменяет пункт
ЗАДАНИЯ, или ты сам предлагаешь отступить от него и получаешь согласие —
запиши это в РЕШЕНИЯ.md ДО коммита, одной записью:

```
## <дата> — <что решили, одной строкой>
Было: <как было согласовано и где это записано>
Стало: <как теперь>
Почему: <причина>
Кто: владелец / предложил я — владелец согласился / вынужденно,
     внешнее ограничение
```

Ни одно отступление от ЗАДАНИЕ.md, CLAUDE.md или памяти проекта не
уходит в коммит без записи в РЕШЕНИЯ.md. Без записи изменение считается
несогласованным.
