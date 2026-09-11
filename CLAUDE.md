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

## Architecture

Deliberately a **single-file vanilla-JS app** (`index.html`) + a handful of
Vercel serverless functions under `api/`. No build step, no framework, no
bundler. Keep it that way — don't introduce React/Vue/a bundler/npm deps
unless explicitly asked; the whole point is that it's one file you can read
top to bottom.

- `index.html` — everything: markup skeleton, all CSS, all client JS. Organized
  in numbered sections (search for `/* ---... N. ... ---... */` comment
  headers) — config, currency rates, customs calc, rendering, history,
  settings, KP-image builder, sharing, Telegram auth/gate, boot.
- `api/rates.js` — currency rate fetching (CNY/JPY/KRW/USDT/EUR), each with
  its own source (see `DEFAULT_CONFIG.rates` in index.html for exact source
  URLs/notes per currency) and a pinned Russian root CA for sources that need it.
- `api/customs.js` — customs duty/util-fee calc via TKS.RU official API
  (primary) with alta.ru fallback, rate-limited to 1 req/sec via Redis.
- `api/parse-listing.js` — "smart autofill": GigaChat (Sber) integration that
  extracts structured car data from pasted listing text or a Japanese
  auction-sheet photo. GigaChat was chosen because most Western AI APIs
  (Gemini, Anthropic, OpenAI-adjacent) are geo-blocked for Russia — see
  git history if this ever needs revisiting.
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

Sends: a text message (`text`) + a branded PNG "commercial offer" image
(`buildKpHtml` → `renderKpImageBlob` via html2canvas, off-screen render at
1080px base width) via `navigator.share({files, text, title})`. One merged
button with three colored segments (WhatsApp/Telegram/MAX) — they all go
through the same share call; there is no per-messenger text formatting
difference anymore (no bold markup anywhere — WhatsApp's `*bold*` and any
Telegram/MAX markdown-on-paste hypothesis were both dead ends, see git log
around Sept 2026 if curious why).

**Known platform quirks, handle with care:**
- **iOS WhatsApp** can't accept a file+text share together (documented
  WhatsApp iOS share-extension limitation, same issue known to
  react-native-share/Flutter share_plus). Worked around by detecting
  `Telegram.WebApp.platform==='ios'` and, only for WhatsApp there, sharing
  the photo alone (`navigator.share({files:[file]})`) while copying the
  caption text to the clipboard separately. **Do not extend this iOS
  special-case to other channels or platforms** — it was tuned specifically
  for this one confirmed-working combination.
- **Telegram's Android Mini App WebView doesn't expose `navigator.share` at
  all** (confirmed via the owner's own device — plain Chrome on the same
  phone has full Share API support, including file+text together; inside
  Telegram's Android container it's `undefined`). This is a Telegram
  platform gap, not something fixable in our JS. Worked around by detecting
  `navigator.share` is missing and routing through
  `Telegram.WebApp.openLink()` (opens the real external browser, doesn't
  close the Mini App) to `share.html?id=...`, where the image+text (already
  rendered) are handed off via the short-lived `api/share-relay.js` KV
  store, and the user taps "Поделиться" **in that external-browser page**
  (Web Share API needs a fresh user gesture in the page that calls it — an
  app-to-app handoff doesn't count, hence the one extra tap there). Falls
  back further to a bottom-sheet showing the image for long-press
  save/share if even that fails. **Do not try to "fix" this by calling
  `navigator.share` a second time on failure inside the Mini App itself —
  a retry-after-failure pattern there was tried once and it actively broke
  WhatsApp by interrupting an in-flight share; removed for good reason.**
- If Telegram ever ships a native Android fix for this (their own docs
  imply `navigator.share` *should* work in native clients, so this may well
  be a bug on their end rather than permanent), the `openLink` relay branch
  will simply stop being reached (guarded behind `!navigator.share`) — no
  need to rip it out, it's self-obsoleting.
- `diag.html` (`/diag`) is a no-auth standalone page for testing
  `navigator.share`/`canShare`/`clipboard`/download capability directly,
  outside the Mini App gate — useful if a sharing bug is reported again on
  an unfamiliar device; walk the reporter through it before guessing at fixes.

## The KP (commercial-offer) image

`buildKpHtml(route, f, r)` renders a fixed-design HTML card (logo, header,
3 stat boxes, numbered payment breakdown, ИТОГО bar, optional insurance
note, optional car-parameters table, footer) matching an approved design
mockup pixel-for-pixel (the logo is literally cropped from that mockup PNG
and embedded as `LOGO_DATA_URI`, not redrawn). `renderKpImageBlob` turns it
into a PNG via html2canvas at a scale chosen to stay under mobile WebView
canvas limits (~16M px area / ~4096px per side — a fixed high scale used to
silently fail the whole render on real phones with long receipts).
"Параметры автомобиля" section only appears when `f.showCarDetails` is on
(same show/hide rule as the text message); individual fields inside show
"—" when empty since it's a fixed table layout, not freely-omittable lines
like the text version.

## Standing conventions (from the owner, apply without re-asking)

- Respond to the owner in Russian in normal conversation.
- Commit and push after every change, without being asked.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
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
