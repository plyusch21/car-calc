/**
 * Отправка сообщений в Telegram Bot API — общий кусок, который раньше был
 * только внутри api/rates-refresh.js (sendTelegramAlert). Вынесен сюда,
 * т.к. Блок 10 ЗАДАНИЯ.md добавляет ещё двух получателей: владельца (новая
 * заявка на доступ) и самого заявителя (его заявку одобрили) — дублировать
 * поиск владельца по HASH "access" в трёх местах не стоило.
 */

const { kv } = require('./kv');

function escapeTg(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function sendTelegramMessage(chatId, text) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || !chatId) return;
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
  }).catch(() => {}); // уведомление не должно валить основной запрос (заявку/одобрение)
}

async function findOwnerUid() {
  const allRaw = await kv('HGETALL', 'access');
  if (!allRaw || !allRaw.length) return null;
  for (let i = 0; i < allRaw.length; i += 2) {
    try { if (JSON.parse(allRaw[i + 1]).isOwner) return allRaw[i]; } catch (e) { /* skip */ }
  }
  return null;
}

async function sendOwnerMessage(text) {
  const ownerUid = await findOwnerUid();
  if (!ownerUid) return;
  await sendTelegramMessage(ownerUid, text);
}

module.exports = { sendTelegramMessage, sendOwnerMessage, findOwnerUid, escapeTg };
