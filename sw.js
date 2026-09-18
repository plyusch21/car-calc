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
