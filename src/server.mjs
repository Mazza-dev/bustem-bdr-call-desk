import http from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, mkdir, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCall, eventFor, johannesburgParts, reportFor, reviewCall } from './core.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dataFile = process.env.DATA_FILE || join(root, 'data', 'state.json');
const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || '127.0.0.1';
const token = process.env.APP_TOKEN || '';
const makeUrl = process.env.MAKE_WEBHOOK_URL || '';
const makeKey = process.env.MAKE_WEBHOOK_KEY || '';
const allowDemoWebhook = process.env.ALLOW_DEMO_WEBHOOK === 'true';
if (!['127.0.0.1', 'localhost', '::1'].includes(host) && !token) {
  throw new Error('Set APP_TOKEN before binding beyond localhost.');
}

const empty = () => ({ calls: [], outbox: [] });
let state = existsSync(dataFile) ? JSON.parse(await readFile(dataFile, 'utf8')) : empty();
const save = async () => {
  await mkdir(dirname(dataFile), { recursive: true });
  const temp = `${dataFile}.tmp`;
  await writeFile(temp, JSON.stringify(state, null, 2));
  await rename(temp, dataFile);
};
const json = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};
const body = async req => {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 500000) throw new Error('Request too large.');
  }
  return JSON.parse(raw || '{}');
};
const addEvent = event => {
  const prior = state.outbox.find(item => item.id === event.id);
  if (prior) return prior;
  state.outbox.unshift(event);
  return event;
};
const deliver = async event => {
  if (!allowDemoWebhook && (event.payload.source === 'demo' || event.demoOnly)) {
    event.status = 'preview';
    await save();
    return;
  }
  if (!makeUrl) {
    event.status = 'ready';
    await save();
    return;
  }
  event.attempts += 1;
  try {
    const response = await fetch(makeUrl, {
      method: 'POST', signal: AbortSignal.timeout(8000),
      headers: {
        'Content-Type': 'application/json',
        'X-Event-Id': event.id,
        ...(makeKey ? { 'x-make-apikey': makeKey } : {})
      },
      body: JSON.stringify({ eventId: event.id, type: event.type, ...event.payload })
    });
    if (!response.ok) throw new Error(`Make returned ${response.status}`);
    event.status = 'sent';
    event.sentAt = new Date().toISOString();
    delete event.error;
  } catch (error) {
    event.status = 'failed';
    event.error = String(error.message || error).slice(0, 180);
  }
  await save();
};

async function sendDailyReport(date = johannesburgParts().date, scheduled = false) {
  const calls = !makeUrl || allowDemoWebhook ? state.calls : state.calls.filter(call => call.source !== 'demo');
  const report = reportFor(calls, date);
  const next = eventFor('report.ready', null, report);
  if (!scheduled) {
    const fingerprint = createHash('sha256').update(report.message).digest('hex').slice(0, 12);
    next.id = `report:${date}:current:${fingerprint}`;
  }
  const event = addEvent(next);
  event.demoOnly = Boolean(makeUrl) && !allowDemoWebhook && state.calls.some(call => call.source === 'demo') && !calls.length;
  await save();
  if (event.status !== 'sent') await deliver(event);
  return { report, event };
}

async function route(req, res) {
  const url = new URL(req.url, `http://${host}:${port}`);
  if (url.pathname.startsWith('/api/') && token && req.headers['x-desk-token'] !== token) {
    return json(res, 401, { error: 'Access token required.' });
  }
  if (req.method === 'GET' && url.pathname === '/api/state') {
    return json(res, 200, {
      calls: state.calls, outbox: state.outbox, report: reportFor(state.calls),
      makeConfigured: Boolean(makeUrl), mode: 'local server'
    });
  }
  if (req.method === 'POST' && url.pathname === '/api/calls') {
    const input = await body(req);
    const existing = state.calls.find(call => call.source === (input.source || 'demo') && call.sourceId === input.sourceId);
    if (existing) return json(res, 200, { call: existing, duplicate: true });
    const call = createCall(input);
    state.calls.unshift(call);
    const event = addEvent(eventFor('call.ended', call));
    await save();
    await deliver(event);
    return json(res, 201, { call, event, duplicate: false });
  }
  const approve = url.pathname.match(/^\/api\/calls\/([^/]+)\/approve$/);
  if (req.method === 'POST' && approve) {
    const call = state.calls.find(item => item.id === approve[1]);
    if (!call) return json(res, 404, { error: 'Call not found.' });
    const input = await body(req);
    call.account = String(input.account || call.account).trim().slice(0, 160);
    call.rep = String(input.rep || call.rep).trim().slice(0, 100);
    call.contactEmail = String(input.contactEmail || '').trim().slice(0, 160);
    reviewCall(call, input);
    const event = addEvent(eventFor('call.approved', call));
    await save();
    await deliver(event);
    return json(res, 200, { call, event });
  }
  if (req.method === 'POST' && url.pathname === '/api/report/send') {
    return json(res, 200, await sendDailyReport(johannesburgParts().date, false));
  }
  const retry = url.pathname.match(/^\/api\/events\/([^/]+)\/retry$/);
  if (req.method === 'POST' && retry) {
    const event = state.outbox.find(item => item.id === decodeURIComponent(retry[1]));
    if (!event) return json(res, 404, { error: 'Event not found.' });
    await deliver(event);
    return json(res, 200, { event });
  }
  if (req.method === 'POST' && url.pathname === '/api/demo/reset') {
    state = empty();
    await save();
    return json(res, 200, { ok: true });
  }
  const files = { '/': 'index.html', '/index.html': 'index.html', '/style.css': 'style.css', '/app.js': 'app.js' };
  if (req.method === 'GET' && files[url.pathname]) {
    const filename = files[url.pathname];
    const type = filename.endsWith('.css') ? 'text/css' : filename.endsWith('.js') ? 'text/javascript' : 'text/html';
    res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
    return res.end(await readFile(join(root, filename)));
  }
  json(res, 404, { error: 'Not found.' });
}

const server = http.createServer((req, res) => {
  route(req, res).catch(error => json(res, error instanceof SyntaxError ? 400 : 422, { error: error.message }));
});
server.listen(port, host, () => console.log(`Bustem Call Desk at http://${host}:${port}`));

// The process must remain running for the Johannesburg end of day send.
setInterval(() => {
  const { date, time } = johannesburgParts();
  if (time >= '18:00' && !state.outbox.some(event => event.id === `report:${date}`)) {
    sendDailyReport(date, true).catch(error => console.error('Daily report failed:', error.message));
  }
}, 60000).unref();
