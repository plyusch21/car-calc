/**
 * Minimal Upstash Redis REST client. Vercel injects KV_REST_API_URL /
 * KV_REST_API_TOKEN automatically once a KV/Upstash database is connected
 * to the project (Storage tab in the Vercel dashboard) — no extra config.
 *
 * Uses the generic command form: POST {url}/ with a JSON array body
 * ["COMMAND", ...args] — works for any command without URL-encoding
 * pitfalls (values here are JSON blobs, which can contain characters
 * that break the path-segment form of the REST API).
 */

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function kv(...command) {
  if (!KV_URL || !KV_TOKEN) {
    throw new Error('Хранилище не подключено (нет KV_REST_API_URL/KV_REST_API_TOKEN) — подключите Upstash/KV в Vercel → Storage');
  }
  const res = await fetch(KV_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(command)
  });
  const data = await res.json();
  if (data.error) throw new Error('KV: ' + data.error);
  return data.result;
}

module.exports = { kv };
