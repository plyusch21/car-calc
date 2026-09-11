/**
 * /api/share-relay — short-lived handoff for the "no Web Share API inside
 * Telegram's Android Mini App WebView" workaround.
 *
 * On that WebView navigator.share doesn't exist at all (confirmed on the
 * owner's device — plain Chrome on the same phone has it and shares fine).
 * Telegram.WebApp.openLink() opens the SYSTEM browser instead, which does
 * have it — but blob:/data: URLs and in-memory JS state can't cross from
 * one app/process to another, so the rendered image has to go through
 * something durable and fetchable. This is that: the client POSTs the
 * already-rendered image (as a data URL) and caption text here, gets back
 * a short id, opens share.html?id=... in the external browser, and that
 * page fetches the payload back by id and shares it there instead — where
 * navigator.share works. One-time use, short TTL, no auth (this data is
 * exactly what the operator is about to hand to a client anyway).
 */

const { kv } = require('./_lib/kv');
const crypto = require('crypto');

const MAX_LEN = 1_500_000; // ~1.1MB image after base64 — comfortable KV headroom

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
    if (body.action === 'put') {
      const imageDataUrl = String(body.imageDataUrl || '');
      if (!imageDataUrl.startsWith('data:image/')) {
        res.status(200).send(JSON.stringify({ error: 'нет картинки' }));
        return;
      }
      if (imageDataUrl.length > MAX_LEN) {
        res.status(200).send(JSON.stringify({ error: 'картинка слишком большая' }));
        return;
      }
      const id = crypto.randomBytes(12).toString('hex');
      const payload = JSON.stringify({
        imageDataUrl,
        text: String(body.text || '').slice(0, 4000),
        title: String(body.title || '').slice(0, 200)
      });
      await kv('SET', 'share:' + id, payload, 'EX', 600);
      res.status(200).send(JSON.stringify({ id }));
      return;
    }

    if (body.action === 'get') {
      const id = String(body.id || '');
      if (!id) { res.status(200).send(JSON.stringify({ error: 'нет id' })); return; }
      const raw = await kv('GET', 'share:' + id);
      if (!raw) { res.status(200).send(JSON.stringify({ error: 'ссылка устарела, попробуйте снова' })); return; }
      kv('DEL', 'share:' + id).catch(() => {});
      res.status(200).send(raw);
      return;
    }

    res.status(200).send(JSON.stringify({ error: 'неизвестное действие' }));
  } catch (e) {
    res.status(200).send(JSON.stringify({ error: e.message || String(e) }));
  }
};
