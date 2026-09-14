export function validateContact(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid enquiry.');
  const text = (key, max, min = 1) => {
    if (typeof input[key] !== 'string') throw new Error(`Please enter ${key}.`);
    const value = input[key].trim();
    if (value.length < min || value.length > max) throw new Error(`Please check ${key}.`);
    return value;
  };
  if (input.website) throw new Error('Unable to accept this enquiry.');
  const email = text('email', 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email address.');
  if (!['demo', 'school', 'partnership', 'support', 'privacy'].includes(input.subject)) throw new Error('Choose an enquiry type.');
  if (input.consent !== true) throw new Error('Please confirm we may reply to your enquiry.');
  return { name: text('name', 100), email, organisation: text('organisation', 200, 0), subject: input.subject,
    message: text('message', 3000, 10), consent: true };
}

async function readBoundedBody(request) {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 12000) {
        await reader.cancel();
        throw new RangeError('Enquiry too large.');
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally { reader.releaseLock(); }
}

export async function submitEnquiry(request, { env = process.env, send = fetch } = {}) {
  const origin = request.headers.get('origin');
  if (!env.SITE_ORIGIN || origin !== env.SITE_ORIGIN) return Response.json({ error: 'Unrecognised request origin.' }, { status: 403 });
  if (!request.headers.get('content-type')?.startsWith('application/json')) return Response.json({ error: 'JSON required.' }, { status: 415 });
  if (Number(request.headers.get('content-length')) > 12000) return Response.json({ error: 'Enquiry too large.' }, { status: 413 });
  let body;
  try {
    const raw = await readBoundedBody(request);
    body = validateContact(JSON.parse(raw));
  } catch (error) {
    if (error instanceof RangeError) return Response.json({ error: 'Enquiry too large.' }, { status: 413 });
    return Response.json({ error: error instanceof SyntaxError ? 'Invalid enquiry.' : error.message }, { status: 400 });
  }
  if (!env.CONTACT_WEBHOOK_URL || !env.CONTACT_WEBHOOK_TOKEN) return Response.json({ error: 'Enquiries are temporarily unavailable. Please try again later.' }, { status: 503 });
  try {
    const url = new URL(env.CONTACT_WEBHOOK_URL);
    if (url.protocol !== 'https:' && !(env.NODE_ENV !== 'production' && url.hostname === '127.0.0.1')) throw new Error('HTTPS required');
    const result = await send(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.CONTACT_WEBHOOK_TOKEN}` }, body: JSON.stringify(body) });
    if (!result.ok) return Response.json({ error: 'Your enquiry could not be delivered. Please try again.' }, { status: result.status === 429 ? 429 : 502 });
    return Response.json({ ok: true }, { status: 201 });
  } catch {
    return Response.json({ error: 'Your enquiry could not be delivered. Please try again.' }, { status: 502 });
  }
}
