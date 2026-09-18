# ТЗ 15 — Вход через Telegram вне мини-приложения (PWA, шаг 1 из 3)

Результат: приложение `car-calc-eight.vercel.app` открывается и работает в обычном браузере телефона или компьютера (Safari, Chrome, «на экран Домой») — не только внутри Telegram. Вне Telegram человек входит кнопкой «Войти через Telegram» (Telegram OpenID Connect), после чего это **тот же пользователь с тем же Telegram id**, что и в мини-приложении: те же доступы (`access/<uid>`), уровень «Сделок», тема, история, сделки. Внутри Telegram мини-приложение работает как сейчас, без изменений в поведении.

Это первый из трёх шагов темы «PWA» (дальше: манифест + service worker; инструкция менеджерам). Модель: **Fable** — задача архитектурная и сквозная (все серверные функции и все обращения к серверу), формулируется результатом, а не шагами. Одна сессия.

---

## 0. Подготовка — делает владелец (до запуска исполнителя)

1. В Telegram открыть мини-приложение @BotFather → выбрать бота приложения → раздел **Login Widget** → нажать **Switch to OpenID Connect Login**. На новом экране: **Redirect URIs** → добавить `https://car-calc-eight.vercel.app/` (с косой чертой, «must match exactly»); **Trusted Origins** → добавить `https://car-calc-eight.vercel.app`. Там же показаны **Client ID** (у нас `8646054246`) и **Client Secret**.
2. Vercel → Project → Settings → Environment Variables (Production и Preview): `TELEGRAM_LOGIN_CLIENT_ID` = Client ID, `TELEGRAM_LOGIN_CLIENT_SECRET` = Client Secret, `SESSION_SECRET` = случайная строка 40+ символов (сгенерировать любым способом, например в Терминале `openssl rand -hex 32`). Секреты никуда, кроме Vercel, не вставлять — в чат Claude Code тоже.
3. Написать исполнителю при запуске: «переменные TELEGRAM_LOGIN_CLIENT_ID, TELEGRAM_LOGIN_CLIENT_SECRET, SESSION_SECRET в Vercel добавлены, адрес в BotFather зарегистрирован».

## Что известно про механизм Telegram (проверено аналитиком 18.09.2026)

Старый «Login Widget» с hash-подписью убран Telegram в архив. Актуальный вход на сайты — OpenID Connect: `https://core.telegram.org/widgets/login`. Discovery `https://oauth.telegram.org/.well-known/openid-configuration` отдаёт: authorization `https://oauth.telegram.org/auth`, token `https://oauth.telegram.org/token`, JWKS `https://oauth.telegram.org/.well-known/jwks.json`; `response_types: code`; `grant_types: authorization_code`; `token_endpoint_auth_methods: client_secret_basic, client_secret_post`; `code_challenge_methods: plain, S256`; `id_token` подписан RS256 (также ES256/EdDSA/ES256K); claims: `sub, name, preferred_username, picture, phone_number, aud, iss, iat, exp`; scopes `openid profile phone telegram:bot_access`.

**Исполнителю обязательно прочитать актуальную страницу документации перед реализацией** — детали могли уточниться после 18.09. Ключевой вопрос, который надо подтвердить на практике (см. «Проверить», п. 2): `sub` в id_token равен числовому Telegram user id — тому же, что `user.id` в `initData` мини-приложения. Если окажется иначе — остановиться и написать аналитику, не придумывать сопоставление.

Почему redirect-flow, а не всплывающее окно: в приложении «с экрана Домой» на iPhone всплывающие окна и обратная связь из них ненадёжны, а переход на страницу Telegram и обратно в том же окне работает. Поэтому JS-библиотеку `telegram-login.js` (popup) не использовать; только authorization code + PKCE (S256) через переход всей страницы.

## Где в коде (коммит `4169409`)

- `api/_lib/telegram.js` — `verifyInitData()` (подпись мини-приложения). Не менять.
- `api/_lib/access.js` — `authenticate(initData)` (строки 21–60): единственная точка, где личность превращается в `{uid, user, record}`; там же авто-заявка «pending» и уведомление владельцу.
- Вызовы `authenticate(body.initData)`: `api/auth.js:22`, `api/admin.js:25`, `api/customs.js:293`, `api/deals.js:260`, `api/parse-listing.js:1338`, `api/share-relay.js:48`, `api/state.js:37`.
- `api/_lib/kv.js` — обёртка над Upstash (`kv('SET', k, v, 'EX', сек)` и т. п. — посмотреть сигнатуру).
- `index.html`: `getInitData()` 650; все обращения к серверу — `grep -n 'initData:getInitData()\|initData: tg.initData' index.html` (26 мест, включая `BkTheme` в `<head>` строка 49); `openExternal()` 812–815; `syncTelegramUI()` 2906; `renderGate()` / `bootGate()` 2925–3020 (гейт `no-telegram` 2942–2943, `--tg-top-pad` 2963–2978, `/api/auth` 2982, `BkTheme.sync` 2991); настройки — `SETTINGS_SECTIONS` 2349, `renderSettingsView()` 2361; CSS `--tg-top-pad` 104 и 161; путь шаринга через `tg.openLink` 2107–2120.
- `deals.html`: `initData()` 665, `api()` 668–671, `boot()` 1968–2000 (гейт 1970–1973, `--tg-top-pad` 1978–1988), `BkTheme` в `<head>` строка 48, CSS 97 и 129.
- `diag.html`: `initData()` 45, строка 76 (диагностика входа), 271 (гейт для che168).
- `vercel.json` — `builds`/`routes`: новую функцию `api/login.js` добавить в оба списка, как остальные `api/*.js`.
- `CLAUDE.md` — раздел про доступ/`access` (grep `access.js`, `initData`) — дополнить.

## Что должно получиться

### Сервер

1. **Сессия приложения.** Строка вида `<base64url(JSON{uid, name, username, iat, exp})>.<HMAC-SHA256 по SESSION_SECRET, base64url>`. Срок 90 дней. Выпускается только после успешного входа через Telegram. Проверка: подпись через `crypto.timingSafeEqual`, `exp` не прошёл. Никаких серверных списков сессий — «Выйти» просто стирает строку на клиенте (допущение, см. ниже).

2. **`authenticate()` принимает оба способа.** Сигнатура `authenticate(initData, session)`; сначала `initData` (если есть и валиден — как сейчас), иначе `session`. Оба пути дают одинаковый результат `{ok, uid, user:{id, first_name, last_name, username}, record}` и проходят одну и ту же логику `access` (заявка pending, обновление имени, уведомление владельцу). Все 7 вызовов → `authenticate(body.initData, body.session)`. Если нет ни того, ни другого — прежняя ошибка 401.

3. **Новая функция `api/login.js`**, POST, `action`:
   - `start` → генерирует `state` (32 случайных байта, base64url) и `code_verifier` (43–128 символов), считает `code_challenge` S256, кладёт в KV `login:<state>` = `{verifier, createdAt}` на 10 минут, отвечает `{url}` — адрес `https://oauth.telegram.org/auth?response_type=code&client_id=…&redirect_uri=https://car-calc-eight.vercel.app/&scope=openid%20profile&state=…&code_challenge=…&code_challenge_method=S256`. `redirect_uri` — ровно тот, что зарегистрирован в BotFather в списке Redirect URIs (`https://car-calc-eight.vercel.app/`, с косой чертой); брать из константы, не из `req.headers.host` (на preview-доменах вход всё равно невозможен — Telegram пускает только на зарегистрированный адрес).
   - `callback` `{code, state}` → достать и **удалить** `login:<state>` (одноразово; нет — ошибка «вход устарел, попробуйте ещё раз»); POST на token endpoint (`grant_type=authorization_code`, `code`, `redirect_uri`, `code_verifier`, `client_id`, `client_secret` — способ `client_secret_post` или Basic, по документации); из ответа взять `id_token`; **проверить JWT**: подпись по JWKS (`crypto.createPublicKey({key: jwk, format:'jwk'})` + `crypto.verify`, алгоритм из заголовка токена — RS256/ES256/EdDSA, без npm-зависимостей — в репозитории нет `package.json`, так и оставить), `iss === 'https://oauth.telegram.org'`, `aud` содержит Client ID, `exp` не прошёл; JWKS кэшировать в памяти функции на час, при неизвестном `kid` перечитать один раз. Из claims: `uid = sub`, имя из `name` (разбить по первому пробелу на first/last или положить всё в first_name), `username` из `preferred_username`. Выдать сессию (п. 1) и ответить `{session, name}`. Любая ошибка — 401 с понятным русским текстом без утечки секретов.
   - Таймауты на внешние запросы 10 с; переменных окружения нет → 500 «вход через сайт не настроен (TELEGRAM_LOGIN_CLIENT_ID)».

4. **Уведомление владельцу** о новой заявке (`access.js`) — как сейчас, независимо от способа входа.

### Клиент — `index.html`

5. **Одна функция авторизации для всех запросов.** Вместо `initData:getInitData()` во всех 26 местах (и в `BkTheme` в `<head>`) — `...authFields()`, где `authFields()` возвращает `{initData}` внутри Telegram и `{session}` вне его (`localStorage` ключ `bk_session_v1`). В `<head>` до объявления функции — прочитать `localStorage` напрямую. Ни одного обращения к серверу без одного из двух полей.

6. **Гейт.** `bootGate()`: если есть `initData` — путь как сейчас. Иначе:
   - в URL есть `?code=…&state=…` → `POST /api/login {action:'callback', code, state}` → сохранить `session` → убрать параметры из адреса `history.replaceState` → дальше как обычный старт с сессией;
   - есть сохранённая сессия → `/api/auth` с ней; ответ 401 (сессия истекла или `SESSION_SECRET` сменили) → стереть сессию и показать экран входа;
   - нет ничего → экран входа вместо «Откройте через Telegram»: логотип, «Байкал Авто · Калькулятор», кнопка `Войти через Telegram` (стиль `.btn.primary`), подпись мелким: «Вход для сотрудников. Доступ выдаёт владелец.» Нажатие → `POST /api/login {action:'start'}` → `location.href = url` (переход всей страницы, не `window.open`). Ошибка сети — текст под кнопкой и кнопка «Повторить».
   - Статусы `pending` / `revoked` / ошибка — те же экраны `renderGate`, что сейчас, плюс на них кнопка «Выйти» (стирает сессию, показывает экран входа), чтобы можно было войти другим аккаунтом.

7. **Поведение вне Telegram.** Всё, что завязано на объект `Telegram.WebApp`, должно тихо работать без него (скрипт `telegram-web-app.js` подключён всегда, объект есть, но `initData` пустой — большинство методов и так no-op; проверить каждое место): `--tg-top-pad` вне Telegram = `0px` (только `--safe-top`); `syncTelegramUI` / `BackButton` — ничего не делает; закрытие листов и выход из подраздела настроек — кнопками на экране (они есть: `settingsBack`, кнопки закрытия листов) — убедиться, что без BackButton нигде не остаётся тупика; `openExternal()` — вне Telegram `window.open`; `tgHaptic` — no-op; `setHeaderColor/setBackgroundColor` — уже под `if(t.initData)`; шаринг КП — `navigator.share` (путь 2) работает в Safari/Chrome, путь через `/share`-relay (3) только когда есть `tg.openLink` **и** `initData`, иначе сразу путь 4.

8. **«Выйти».** В `SETTINGS_SECTIONS` — раздел `Аккаунт` (или строка в существующем разделе про доступ): имя пользователя, «Вход: Telegram Mini App» / «Вход: через сайт», кнопка «Выйти» — показывается только вне Telegram (внутри мини-приложения выходить некуда). Стирает `bk_session_v1`, перерисовывает экран входа.

### Клиент — `deals.html` и `diag.html`

9. `deals.html`: тот же `authFields()`; гейт `boot()` — при отсутствии `initData` и наличии сессии работать с ней; нет сессии → сообщение «Войдите в калькулятор» с кнопкой-ссылкой на `/` (вход делается только на главной, чтобы не дублировать OAuth-логику). `--tg-top-pad` вне Telegram = 0. `BkTheme` в `<head>` — сессия в `saveTheme`.
10. `diag.html`: `authFields()` вместо `initData()`; строка 76 показывает «Вход: Mini App / сессия / нет»; гейт 271 — «нет входа» только если нет ни того, ни другого. Кнопка «Диагностика» в настройках открывает `/diag` переходом — вне Telegram работает так же.

### Прочее

11. `vercel.json` — `api/login.js` в `builds` и `routes`.
12. `CLAUDE.md`: раздел про доступ — два способа входа, формат сессии, переменные окружения `TELEGRAM_LOGIN_CLIENT_ID/SECRET`, `SESSION_SECRET`; правило «всякий запрос к серверу идёт через `authFields()`». `.claude/map.md` — `bash tools/mapgen.sh`.

## Не трогать

`verifyInitData()`, модель `access` (поля, статусы, уровни «Сделок»), `state:config`, расчёты (`lib/calc.js`), тексты и логику всех экранов кроме гейта и раздела «Аккаунт», темы (только передача сессии в `saveTheme`), `share.html`, `api/rates*.js` (они без авторизации).

## Проверить

1. В Telegram (iPhone и Android): приложение открывается и работает как раньше — расчёт, автозаполнение, сделки, тема, `/diag`. Ни одного изменения в поведении.
2. **Совпадение id.** Владелец в Safari на телефоне открывает `car-calc-eight.vercel.app` → «Войти через Telegram» → подтверждает в Telegram → попадает внутрь **как владелец** (вкладка «Настройки» с «Доступом к приложению» на месте, тема его). Исполнитель дополнительно сверяет: `sub` из id_token (вывести в лог `api/login` один раз при отладке, потом убрать) равен ключу записи владельца в `HGETALL access`. Не равен — стоп, доклад аналитику.
3. Сотрудник с доступом `pending` входит через сайт — экран «Доступ ожидает подтверждения», владельцу приходит уведомление; после одобрения «Проверить ещё раз» пускает.
4. Закрыть Safari, открыть снова — вход помнится; «Выйти» → экран входа; повторный вход работает. Устаревший `state` (повторно открыть старый callback-адрес) → «вход устарел».
5. Подменить `SESSION_SECRET` в Vercel → старые сессии дают экран входа, а не бесконечную ошибку.
6. Вне Telegram: сверху нет пустой полосы 44 px; листы закрываются кнопками; подраздел настроек закрывается «Назад»; ссылки открываются в новой вкладке; отправка КП — системное «Поделиться» в Safari и Chrome.
7. В браузере на компьютере — то же, что на телефоне (ширина ограничена как сейчас).
8. `/deals` вне Telegram с сессией — работает; без сессии — «Войдите в калькулятор» и ссылка.
9. `grep -n 'initData' index.html deals.html diag.html` — только внутри `authFields()`/`getInitData()` и в комментариях; `grep -n 'authenticate(' api/*.js` — все с двумя аргументами.
10. `node tools/calc-check.js` — 22 строки совпадают.

## Допущения (владелец может возразить)

- Сессия 90 дней, без серверного списка активных сессий: отозвать чей-то вход владелец может, переведя пользователя в `revoked` в «Доступе к приложению» — это проверяется при каждом запросе, как и сейчас. Отзыв *всех* сессий разом — сменить `SESSION_SECRET` в Vercel.
- Вход только через Telegram: «телефон + СМС» отвергнут раньше (платный провайдер, вторая база пользователей).
- На preview-доменах Vercel вход через сайт не работает (Telegram пускает только на зарегистрированный адрес); проверять на боевом. Мини-приложение на preview работает как раньше.
- Scope `profile` без `phone`: телефон не нужен.
- Если при реализации выяснится, что Telegram требует иного (например, `sub` не равен user id или нужен другой scope для id) — исполнитель останавливается и пишет аналитику, а не изобретает обход.

В конце: `bash tools/mapgen.sh`, коммит и пуш в main по правилам CLAUDE.md. Отступления — в `РЕШЕНИЯ.md`.
