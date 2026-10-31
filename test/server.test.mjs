import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const close = server => new Promise(resolve => server.close(resolve));

test('completed call, rep review, duplicate protection, and Make dispatch', async t => {
  const received = [];
  const make = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    received.push({ body: JSON.parse(raw), key: req.headers['x-make-apikey'] });
    res.writeHead(200); res.end('accepted');
  });
  const makePort = await listen(make);
  const temp = await mkdtemp(join(tmpdir(), 'bustem-call-desk-'));
  const probe = http.createServer();
  const port = await listen(probe);
  await close(probe);
  const child = spawn(process.execPath, ['src/server.mjs'], {
    cwd: root, env: { ...process.env, PORT: String(port), DATA_FILE: join(temp, 'state.json'),
      MAKE_WEBHOOK_URL: `http://127.0.0.1:${makePort}/`, MAKE_WEBHOOK_KEY: 'test-only-key' },
    stdio: 'ignore'
  });
  t.after(async () => { child.kill(); await close(make); await rm(temp, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try { const result = await fetch(`${base}/api/state`); ready = result.ok; if (ready) break; }
    catch { /* server still starting */ }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.equal(ready, true, 'server started');
  const post = async (path, body) => {
    const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    const result = await response.json();
    assert.equal(response.ok, true, result.error || 'request failed');
    return result;
  };
  const input = { source: 'parley', sourceId: 'rec-test', account: 'Example Brand',
    contactEmail: 'buyer@example.com', createdAt: new Date().toISOString(), transcript: '[0:00] [Buyer] A fake site is live.' };
  const first = await post('/api/calls', input);
  assert.equal(first.duplicate, false);
  assert.equal(received.length, 1);
  assert.equal(received[0].body.type, 'call.ended');
  assert.equal(received[0].key, 'test-only-key');
  const second = await post('/api/calls', input);
  assert.equal(second.duplicate, true);
  assert.equal(received.length, 1);
  await post(`/api/calls/${first.call.id}/approve`, { outcome: 'meeting_booked', issue: 'Fake site', nextStep: 'Confirmed Tuesday meeting' });
  assert.equal(received[1].body.type, 'call.approved');
  const { report } = await post('/api/report/send');
  assert.equal(report.meetingsBooked, 1);
  assert.equal(received[2].body.type, 'report.ready');
  await post('/api/report/send');
  assert.equal(received.length, 3, 'daily report is sent once');
  await post('/api/calls', { ...input, source: 'demo', sourceId: 'sample-test' });
  assert.equal(received.length, 3, 'fictional demo is not sent to Make');
});
