const endpoint = process.env.PARLEY_MCP_URL || 'http://127.0.0.1:3011/mcp';
const desk = process.env.CALL_DESK_URL || 'http://127.0.0.1:8787';
const prefix = process.env.PARLEY_TITLE_PREFIX || 'Bustem';
const folderId = process.env.PARLEY_FOLDER_ID || '';
const rep = process.env.BDR_NAME || 'BDR to confirm';
const interval = Math.max(10, Number(process.env.PARLEY_POLL_SECONDS || 20)) * 1000;
let rpcId = 1;

async function mcp(method, params = {}) {
  const response = await fetch(endpoint, {
    method: 'POST', signal: AbortSignal.timeout(10000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: rpcId++, method, params })
  });
  if (!response.ok) throw new Error(`Parley returned ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'Parley MCP error');
  if (method !== 'tools/call') return data.result;
  const text = data.result?.content?.find(part => part.type === 'text')?.text;
  if (!text) throw new Error('Parley returned no recording data.');
  return JSON.parse(text);
}

async function poll() {
  const args = { since: Date.now() - 7 * 86400000, limit: 100 };
  if (folderId) args.folderId = folderId;
  const list = await mcp('tools/call', { name: 'list_recordings', arguments: args });
  for (const item of list.recordings || []) {
    if (!folderId && !String(item.title || '').toLowerCase().startsWith(prefix.toLowerCase())) continue;
    if (!item.durationMs || item.durationMs < 1000) continue;
    const recording = await mcp('tools/call', { name: 'get_recording', arguments: { id: item.id } });
    if (!recording.transcript?.trim()) continue;
    const account = String(recording.title || '').replace(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[|:]?\\s*`, 'i'), '').trim();
    const context = String(recording.meetingContext || '');
    const contactEmail = context.match(/^Contact email:\s*([^\s]+@[^\s]+)$/im)?.[1] || '';
    const hubspotContactId = context.match(/^HubSpot contact ID:\s*([A-Za-z0-9]+)$/im)?.[1] || '';
    const response = await fetch(`${desk}/api/calls`, {
      method: 'POST', signal: AbortSignal.timeout(12000),
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.APP_TOKEN ? { 'x-desk-token': process.env.APP_TOKEN } : {})
      },
      body: JSON.stringify({
        source: 'parley', sourceId: recording.id, account: account || 'Account to confirm',
        title: recording.title, createdAt: recording.createdAt,
        durationMs: recording.durationMs, transcript: recording.transcript,
        parleyBrief: recording.brief || '', rep, contactEmail, hubspotContactId
      })
    });
    if (!response.ok) throw new Error(`Call Desk returned ${response.status}: ${await response.text()}`);
    const result = await response.json();
    if (!result.duplicate) console.log(`Imported Parley call ${recording.id}: ${recording.title}`);
  }
}

console.log(`Watching Parley at ${endpoint}. Only ${folderId ? `folder ${folderId}` : `titles beginning with ${prefix}`} are imported.`);
await mcp('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'bustem-call-desk', version: '1.0.0' } });
await poll();
setInterval(() => poll().catch(error => console.error(`Parley poll: ${error.message}`)), interval);
