import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const close = server => new Promise(resolve => server.close(resolve));

test('Parley watcher imports a completed Bustem recording', async t => {
  const mcpServer = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const rpc = JSON.parse(raw);
    let result = {};
    if (rpc.method === 'initialize') result = { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'parley', version: 'test' } };
    if (rpc.params?.name === 'list_recordings') result = {
      content: [{ type: 'text', text: JSON.stringify({ recordings: [
        { id: 'rec-a', title: 'Bustem | Example Brand', durationMs: 120000 },
        { id: 'rec-b', title: 'Private meeting', durationMs: 120000 }
      ] }) }]
    };
    if (rpc.params?.name === 'get_recording') result = {
      content: [{ type: 'text', text: JSON.stringify({
        id: 'rec-a', title: 'Bustem | Example Brand', createdAt: Date.now(), durationMs: 120000,
        transcript: '[0:00] [Buyer] Our fake checkout is live.', brief: 'Buyer discussed a fake site.'
      }) }]
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result }));
  });
  const mcpPort = await listen(mcpServer);
  let complete;
  const received = new Promise(resolve => { complete = resolve; });
  const deskServer = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const call = JSON.parse(raw);
    complete(call);
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ call, duplicate: false }));
  });
  const deskPort = await listen(deskServer);
  const child = spawn(process.execPath, ['src/parley.mjs'], {
    cwd: root, env: { ...process.env,
      PARLEY_MCP_URL: `http://127.0.0.1:${mcpPort}/mcp`,
      CALL_DESK_URL: `http://127.0.0.1:${deskPort}`, BDR_NAME: 'Example BDR' },
    stdio: 'ignore'
  });
  t.after(async () => { child.kill(); await close(mcpServer); await close(deskServer); });
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Parley watcher did not import')), 3000));
  const call = await Promise.race([received, timeout]);
  assert.equal(call.source, 'parley');
  assert.equal(call.account, 'Example Brand');
  assert.equal(call.rep, 'Example BDR');
  assert.match(call.transcript, /fake checkout/);
});
