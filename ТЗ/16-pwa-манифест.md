# ТЗ 16 — PWA: иконка «на экран Домой», манифест, минимальный service worker

Что нужно: сотрудник открывает car-calc-eight.vercel.app в Safari или Chrome, добавляет на экран «Домой» — появляется иконка «Байкал Авто», приложение открывается на весь экран без адресной строки. Вход уже есть (ТЗ 15/15-а). Мини-приложение в Telegram не меняется ни в чём.

Модель: Sonnet. Мелко-средне, одна сессия.

## Решения владельца (18.09.2026, не пересматривать)

- **Иконка — вариант А:** белый логотип `logo-kp.png` (прозрачный фон) по центру на тёмно-синем градиенте, как шапка фото-КП (`.kp-hero`). Если владелец позже положит дизайнерскую квадратную иконку — она заменяет сгенерированные файлы, код не трогается.
- **Подпись под иконкой:** «Байкал Авто».
- **Service worker — минимальный:** ничего не кэширует, кроме страницы «Нет подключения». Всё, включая `index.html`, всегда берётся из сети — старая версия залипнуть не может. Регистрируется **только вне Telegram**.

## Где в коде (после `21e9705`, номера сверять через `grep -n`)

- `index.html` строки 1–11: `<head>` — `viewport` (5), `<title>` (6), дальше скрипты; скрипт `BkTheme` начинается ~12, функция `apply()` ~45–50 (там `BG = { dark:'#070c14', light:'#ebebee' }` и покраска шапки Telegram).
- `index.html` `bootGate()` ~3073: ветка `else { // Обычный браузер (ТЗ 15)` ~3093–3098.
- `deals.html` строки 1–10: `<head>`; `BkTheme.apply()` ~40–46 (копия); `boot()` ~1988, ветка `if(!inTelegram()){ // Обычный браузер` ~1990–1993.
- `vercel.json`: `builds` — каждый статический файл перечислен отдельно (иначе он не попадает в деплой); `routes` — последний маршрут `/(.*)` → `/index.html` ловит всё, поэтому новые файлы нужно прописать **выше** него (как `/lib/(.*)`).
- `--safe-top: env(safe-area-inset-top)` уже учтён в отступе шапки (`index.html` ~113, ~172; `deals.html` ~104, ~137) — в полноэкранном режиме на iPhone шапка не уедет под часы, трогать не нужно.

## Что сделать

### 1. Иконки — скрипт `tools/make-icons.py`

Python + Pillow (на Mac стоит, `python3 -c "import PIL"`). Скрипт коммитится, чтобы иконки можно было пересобрать.

- Холст 1024×1024, непрозрачный. Фон — линейный градиент как у `.kp-hero` (`index.html` ~405: `160deg, #0d1626 0%, #12306a 70%, #1a4db5 100%` — сверху тёмный, внизу синий, лёгкий наклон; точный угол не критичен).
- `logo-kp.png` (583×275, RGBA) — по центру, ширина **70 % холста**, пропорции сохранить, ресэмплинг LANCZOS. 70 % выбрано так, чтобы логотип целиком помещался в безопасный круг Android (радиус 40 %) — поэтому одна и та же картинка годится и как обычная, и как `maskable`.
- Углы **не** скруглять (iOS и Android скругляют сами), прозрачности нет (iOS заливает прозрачное чёрным).
- Выход в папку `icons/`: `icon-512.png` (512), `icon-192.png` (192), `apple-touch-icon.png` (180), `favicon-32.png` (32). Уменьшать из 1024 за один шаг.
- Запустить, закоммитить и скрипт, и PNG.

### 2. `manifest.webmanifest` (корень репозитория)

```json
{
  "id": "/",
  "name": "Байкал Авто — калькулятор",
  "short_name": "Байкал Авто",
  "lang": "ru",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#070c14",
  "theme_color": "#070c14",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

`purpose` раздельно, не `"any maskable"` одной строкой.

### 3. `<head>` в `index.html` и `deals.html` — одинаковый блок

Сразу после `<title>` (до скриптов — `BkTheme` ниже должен найти `theme-color` уже на месте):

```html
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#070c14">
<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Байкал Авто">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
```

`<title>` не менять. `diag.html` и `share.html` не трогать.

### 4. `BkTheme.apply()` красит `theme-color` в фон темы

В обеих копиях `apply()` (index.html ~45, deals.html ~40) после `setAttribute('data-theme', th)` добавить:

```js
try{ var tc = document.querySelector('meta[name="theme-color"]'); if(tc) tc.setAttribute('content', BG[th]); }catch(e){}
```

Вне Telegram (Android Chrome, установленное приложение) строка состояния станет в цвет фона и в светлой теме. Покраску Telegram (`setHeaderColor`) не трогать. Копии держать одинаковыми.

### 5. `offline.html` (корень) — экран «Нет подключения»

Самостоятельная страница, **без внешних ресурсов** (без Google Fonts, без telegram-web-app.js, без `/lib/`): открывается как раз тогда, когда сети нет.

- Стили — инлайн в `<style>`, шрифт системный (`-apple-system, system-ui, sans-serif`).
- Тема: маленький скрипт читает `localStorage.bk_theme_v1` (`{mode:'dark'|'light'|'auto'}`, в `try/catch`); `light` → светлая, `auto` → по `matchMedia('(prefers-color-scheme: light)')`, иначе тёмная. Цвета: тёмная фон `#070c14`, текст белый; светлая фон `#ebebee`, текст `#0d1626`. Своих новых цветов не вводить сверх этих и акцентного `#1a4db5` для кнопки.
- Содержимое по центру экрана, с `padding-top: env(safe-area-inset-top)`: заголовок «Нет подключения к интернету», строка «Калькулятору нужна сеть: курсы, таможня и вход проверяются на сервере.», кнопка «Повторить» → `location.reload()`.
- Логотип/иконку на этой странице не показывать (картинка не в кэше — будет битая).
- `<meta name="viewport">` такой же, как в `index.html`.

### 6. `sw.js` (корень) — минимальный service worker

Полный текст, ничего сверх:

```js
/* Service worker car-calc (ТЗ 16). Намеренно минимальный: ничего из
   приложения не кэширует, index.html/deals.html/lib/api всегда из сети —
   старая версия залипнуть не может. Единственная задача — вместо системной
   ошибки браузера показать offline.html, если при открытии нет сети.
   Регистрируется только вне Telegram (registerSW в index.html/deals.html).
   Меняешь offline.html — подними VERSION. Отключить совсем: заменить этот
   файл на самоудаляющийся (self.registration.unregister() в activate),
   а не удалять — удалённый файл не снимает уже установленный worker. */
const VERSION = 'v1';
const CACHE = 'bk-offline-' + VERSION;
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.add(new Request('/offline.html', { cache: 'reload' }))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.mode !== 'navigate' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).catch(() => caches.match('/offline.html')));
});
```

Всё, что не навигация (скрипты, картинки, `/api/*`, шрифты, `telegram.org`), worker не трогает — `respondWith` не вызывается, браузер работает как без него. Навигации с `?code=…&state=…` (возврат со входа) проходят в сеть как есть и не кэшируются.

### 7. Регистрация — только вне Telegram

В `index.html` рядом с `inTelegram()` (~684) и такую же копию в `deals.html` (~674):

```js
// PWA (ТЗ 16): service worker только в обычном браузере / «на экране Домой».
// В Telegram не регистрируем — мини-приложению он не нужен.
function registerSW(){
  if(inTelegram() || !('serviceWorker' in navigator)) return;
  try{ navigator.serviceWorker.register('/sw.js').catch(()=>{}); }catch(e){}
}
```

Вызов: `index.html` — первой строкой ветки «Обычный браузер (ТЗ 15)» в `bootGate()` (до `finishLoginFromUrl()`, чтобы регистрировалось и на экране входа); `deals.html` — первой строкой ветки `if(!inTelegram()){` в `boot()`. Ошибки регистрации молчат — без worker'а приложение работает как сейчас.

### 8. `vercel.json`

В `builds` (к остальным `@vercel/static`):

```json
{ "src": "manifest.webmanifest", "use": "@vercel/static" },
{ "src": "sw.js", "use": "@vercel/static" },
{ "src": "offline.html", "use": "@vercel/static" },
{ "src": "icons/*.png", "use": "@vercel/static" }
```

В `routes` — **перед** `/(.*)`, рядом с `/logo-kp.png`:

```json
{ "src": "/manifest.webmanifest", "dest": "/manifest.webmanifest", "headers": { "Content-Type": "application/manifest+json", "Cache-Control": "no-cache" } },
{ "src": "/sw.js", "dest": "/sw.js", "headers": { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-cache" } },
{ "src": "/offline.html", "dest": "/offline.html" },
{ "src": "/icons/(.*)", "dest": "/icons/$1" },
```

`no-cache` у `sw.js` обязателен: браузер проверяет обновление worker'а по этому файлу.

### 9. `CLAUDE.md` — новый раздел «PWA (ТЗ 16)» после «Тема оформления»

Кратко: что приложение ставится на экран «Домой» из Safari/Chrome, вход — «Войти через Telegram» (ТЗ 15); файлы (`manifest.webmanifest`, `icons/` из `tools/make-icons.py`, `sw.js`, `offline.html`); **service worker намеренно ничего не кэширует кроме `offline.html` и регистрируется только вне Telegram — не добавлять в него кэширование приложения без решения владельца**; как отключить (самоудаляющийся `sw.js`, не удаление файла); новый статический файл = запись в `builds` + маршрут выше `/(.*)`. В разделе «Architecture» в список файлов добавить эти четыре позиции одной строкой каждая.

## Не трогать

Вход и сессии (`api/login.js`, `api/_lib/*`, `renderGate`, `finishLoginFromUrl`), мини-приложение и всё под `inTelegram()`, отправку КП (`shareResult`, `share.html`, `share-relay`), `lib/calc.js` и `?v=1`, `diag.html`, `share.html`, `logo.png`, `logo-kp.png`. Кнопку «Установить приложение» внутри интерфейса не делать — это не входит в ТЗ.

## Проверить

Исполнитель (Browser pane на боевом после деплоя, вне Telegram):

1. `/manifest.webmanifest` отдаётся с `Content-Type: application/manifest+json`, JSON валидный; `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/apple-touch-icon.png`, `/icons/favicon-32.png`, `/offline.html`, `/sw.js` — 200, не `index.html` (проверить `fetch(...).then(r=>r.headers.get('content-type'))`).
2. Открыть сами иконки — логотип по центру, не обрезан, фон градиентный без прозрачности. Приложить в отчёт `icon-512.png` глазами (скриншот).
3. На `/` (экран входа) в консоли: `navigator.serviceWorker.getRegistration().then(r=>console.log(r && r.active && r.active.scriptURL))` → `…/sw.js`; `caches.keys()` → только `['bk-offline-v1']`; `caches.match('/offline.html')` → есть.
4. Открыть `/offline.html` напрямую — экран «Нет подключения», в тёмной и светлой теме (переключить `bk_theme_v1` в localStorage), кнопка работает.
5. Приложение после регистрации worker'а работает как раньше: вход/сессия, расчёт, «Сделки», переход между `/` и `/deals`. Во вкладке сети запросы к `/api/*` идут как обычно (worker их не перехватывает).
6. `<meta name="theme-color">` меняет значение при переключении темы в Настройках (`#070c14` ↔ `#ebebee`).
7. `grep -n "registerSW" index.html deals.html` — определение и один вызов в каждом файле, оба в ветке «не Telegram».
8. `node tools/calc-check.js` — 22 строки совпадают.

**Владелец на телефонах (исполнитель это не проверяет и не пишет «работает на телефоне» — перечисляет владельцу эти пункты в отчёте):**

9. **iPhone, Safari:** car-calc-eight.vercel.app → «Поделиться» → «На экран Домой» — подпись «Байкал Авто», иконка тёмная с логотипом. Открыть с иконки: без адресной строки, шапка не под часами.
10. **Вход в приложении с экрана Домой (главный риск):** у такого приложения на iPhone своё хранилище, вход из Safari сюда не переносится — нужно войти ещё раз. «Войти через Telegram» → подтвердить в Telegram → **вернуться должно в приложение с иконки**, внутрь, владельцем. Если после подтверждения открылся Safari, а приложение с иконки так и осталось на экране входа — ничего не чинить наугад, записать, что именно видно на каждом шаге, и принести аналитику.
11. Светлая тема на iPhone в приложении с экрана: читаются ли часы/батарея вверху (при `black-translucent` iOS рисует их белыми). Не читаются — принести аналитику, не менять самому.
12. Режим полёта → открыть с иконки → экран «Нет подключения»; выключить → «Повторить» → приложение.
13. Отправка КП из приложения с экрана Домой в WhatsApp/Telegram — как в Safari (текст в буфере, фото в «Поделиться»).
14. **Android, Chrome** (Honor): меню ⋮ → «Добавить на гл. экран» / «Установить приложение» → иконка без белой рамки, открывается без адресной строки, строка состояния в цвет фона темы. Вход — как в п. 10.
15. Мини-приложение в Telegram на обоих телефонах — ровно как раньше.

В конце: `bash tools/mapgen.sh`, коммит и пуш в main по правилам CLAUDE.md. Отступлений от ТЗ нет — запись в `РЕШЕНИЯ.md` только если по ходу что-то пришлось изменить.
