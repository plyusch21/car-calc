/**
 * /api/send-telegram — sends the receipt as a real, HTML-formatted message
 * (parse_mode:'HTML', proper <b> bold) into the operator's own chat with
 * this bot.
 *
 * Why this exists: Telegram only turns *markdown* into rich text while a
 * person is typing it live in its own input field — text that arrives via
 * a share link or clipboard paste keeps its literal asterisks. The only
 * way to get real bold text into Telegram at all is a message sent through
 * the Bot API with parse_mode set. Sending it straight to the client isn't
 * possible (a bot can only message chats it already has a chat_id for, and
 * the client has never talked to this bot) — but the operator has, simply
 * by opening this Mini App through it. So the bot delivers the formatted
 * message into that existing chat, and the operator forwards it on to the
 * client from inside Telegram (optionally hiding the sender), never
 * leaving the app.
 */

const https = require('https');
const { authenticate } = require('./_lib/access');

function telegramApi(botToken, method, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${botToken}/${method}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (!parsed.ok) reject(new Error(parsed.description || 'Telegram API error'));
          else resolve(parsed.result);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
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

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    res.status(200).send(JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN не настроен на сервере' }));
    return;
  }

  try {
    const auth = await authenticate(body.initData);
    if (!auth.ok) { res.status(200).send(JSON.stringify({ error: auth.error })); return; }
    if (auth.record.status !== 'approved') {
      res.status(200).send(JSON.stringify({ error: 'доступ не подтверждён', status: auth.record.status }));
      return;
    }

    const html = String(body.html || '').slice(0, 4000);
    if (!html) { res.status(200).send(JSON.stringify({ error: 'пустой текст' })); return; }

    await telegramApi(botToken, 'sendMessage', {
      chat_id: auth.user.id,
      text: html,
      parse_mode: 'HTML'
    });

    res.status(200).send(JSON.stringify({ ok: true }));
  } catch (e) {
    res.status(200).send(JSON.stringify({ error: e.message || String(e) }));
  }
};
