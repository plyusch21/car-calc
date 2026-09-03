/**
 * /api/auth — verifies the Telegram Mini App visitor and returns their
 * access status. Called once on every app open (see bootGate() in
 * index.html). See api/_lib/access.js for the access model.
 */

const { authenticate } = require('./_lib/access');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'POST') {
    res.status(405).send(JSON.stringify({ status: 'error', error: 'method not allowed' }));
    return;
  }

  let body = req.body;
  if (!body || typeof body === 'string') {
    try { body = JSON.parse(body || '{}'); } catch (e) { body = {}; }
  }

  try {
    const result = await authenticate(body.initData);
    if (!result.ok) {
      res.status(200).send(JSON.stringify({ status: 'error', error: result.error }));
      return;
    }
    res.status(200).send(JSON.stringify({
      status: result.record.status, // 'approved' | 'pending' | 'revoked'
      isOwner: !!result.record.isOwner,
      name: result.record.name
    }));
  } catch (e) {
    res.status(200).send(JSON.stringify({ status: 'error', error: e.message || String(e) }));
  }
};
