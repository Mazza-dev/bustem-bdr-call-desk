const $ = selector => document.querySelector(selector);
const sample = [
  { who: 'BDR', text: 'We noticed a site that looks like Oakline Goods. Is that an issue you are seeing?', cue: 'Let them describe the problem before offering a scan.' },
  { who: 'Prospect', text: 'Yes. Customers reported a fake checkout using our product photos last week.', cue: 'Ask for the URL and whether the fake checkout is still live.' },
  { who: 'BDR', text: 'Is it still active, and who on your team handles those reports?', cue: 'Listen for the owner and the current process.' },
  { who: 'Prospect', text: 'It is still up. Our head of ecommerce owns it, but we are tracking complaints in a spreadsheet.', cue: 'Ask whether a free brand scan would help them assess the wider problem.' },
  { who: 'Prospect', text: 'Please send me the scan. Our head of ecommerce can join a call on Tuesday.', cue: 'Confirm the contact details and the agreed time. Do not invent a meeting booking.' }
];
const key = 'bustem-call-desk-demo-v1';
let backend = false;
let state = { calls: [], outbox: [], makeConfigured: false };
let step = -1;
let currentCall = null;

const saDate = iso => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso));
  const part = type => parts.find(item => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};
const today = () => saDate(new Date().toISOString());
const localSave = () => localStorage.setItem(key, JSON.stringify(state));
async function request(path, method = 'GET', payload) {
  const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: payload ? JSON.stringify(payload) : undefined });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Request failed (${response.status})`);
  }
  return response.json();
}
function localReport() {
  const calls = state.calls.filter(call => saDate(call.endedAt || call.createdAt) === today());
  const approved = calls.filter(call => call.review);
  return {
    capturedCalls: calls.length, reviewedCalls: approved.length,
    pendingReview: calls.length - approved.length,
    meetingsBooked: approved.filter(call => call.review.outcome === 'meeting_booked').length,
    handoffs: approved.filter(call => call.review.outcome === 'meeting_booked').map(call => ({
      account: call.account, rep: call.rep, issue: call.review.issue,
      decisionMaker: call.review.decisionMaker, nextStep: call.review.nextStep
    }))
  };
}
async function refresh() {
  if (backend) state = await request('/api/state');
  render();
}
function textEl(tag, className, value) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = value;
  return el;
}
function render() {
  const report = backend ? state.report : localReport();
  $('#reportText').textContent = report.message || [
    `Bustem BDR report for ${today()} (Johannesburg)`,
    `Calls captured: ${report.capturedCalls}. Rep reviewed: ${report.reviewedCalls}. Awaiting review: ${report.pendingReview}.`,
    `Meetings booked: ${report.meetingsBooked}.`,
    report.handoffs.length ? `Meeting handoffs:\n${report.handoffs.map(item => `${item.account}: ${item.nextStep}`).join('\n')}` : 'Meeting handoffs: none confirmed.',
    'Dial totals: unavailable until the dialer is connected.'
  ].join('\n');
  $('#mode').textContent = backend ? 'Local server' : 'Browser demo';
  $('#makeStatus').textContent = state.makeConfigured ? 'Make configured' : 'Preview only';
  $('#sendReport').textContent = state.makeConfigured ? 'Send current report' : 'Preview current report';
  const stats = $('#stats');
  stats.replaceChildren();
  for (const [label, value] of [
    ['Calls captured', report.capturedCalls], ['Rep reviewed', report.reviewedCalls],
    ['Meetings', report.meetingsBooked], ['Need review', report.pendingReview]
  ]) {
    const box = textEl('div', 'stat', '');
    box.append(textEl('strong', '', value), textEl('span', '', label));
    stats.append(box);
  }
  const handoffs = $('#handoffs');
  handoffs.replaceChildren();
  if (!report.handoffs.length) handoffs.append(textEl('p', 'empty', 'No reviewed meeting handoffs yet.'));
  for (const handoff of report.handoffs) {
    const box = textEl('div', 'item', '');
    box.append(textEl('strong', '', `${handoff.account} · ${handoff.rep}`), textEl('p', '', handoff.nextStep || 'Next step to confirm'));
    handoffs.append(box);
  }
  const attention = $('#attention');
  attention.replaceChildren();
  if (!report.pendingReview) attention.append(textEl('p', 'empty', 'No calls awaiting review.'));
  else attention.append(textEl('div', 'item', `${report.pendingReview} call${report.pendingReview === 1 ? '' : 's'} awaiting a rep approved note.`));
  const events = $('#events');
  events.replaceChildren();
  if (!state.outbox.length) events.append(textEl('p', 'empty', 'Events will appear when a sample call ends.'));
  for (const event of state.outbox.slice(0, 6)) {
    const row = textEl('div', 'event', '');
    row.append(textEl('strong', '', event.type), textEl('code', '', event.id), textEl('em', '', event.status));
    events.append(row);
  }
  const pending = state.calls.find(call => !call.review);
  if (pending && (!currentCall || !currentCall.review)) showReview(pending);
}
function renderTranscript() {
  const feed = $('#transcript');
  feed.replaceChildren();
  if (step < 0) return feed.append(textEl('p', 'empty', 'Start the sample call to see the transcript and coaching prompts.'));
  for (const line of sample.slice(0, step + 1)) {
    const row = textEl('div', 'line', '');
    row.append(textEl('strong', '', line.who), textEl('p', '', line.text));
    feed.append(row);
  }
  feed.scrollTop = feed.scrollHeight;
  $('#cueText').textContent = sample[step]?.cue || 'Ask what the brand is seeing today.';
}
function showReview(call) {
  currentCall = call;
  $('#reviewForm').hidden = false;
  $('#reviewEmpty').hidden = true;
  $('#reviewTitle').textContent = call.title;
  $('#account').value = call.account;
  $('#rep').value = call.rep;
  $('#contactEmail').value = call.contactEmail || '';
  $('#issue').value = call.source === 'demo' ? 'Customers reported a fake checkout using product photos last week. The prospect said it is still live.' : '';
  $('#decisionMaker').value = call.source === 'demo' ? 'Head of ecommerce, name to confirm' : '';
  $('#objection').value = '';
  $('#nextStep').value = call.source === 'demo' ? 'Send the scan and confirm a Tuesday call with the head of ecommerce.' : '';
  $('#outcome').value = call.source === 'demo' ? 'follow_up' : 'other';
  $('#reviewMessage').textContent = 'Check every field against the actual call before approving.';
}

$('#startCall').addEventListener('click', () => {
  step = 0;
  $('#callState').textContent = 'Live example';
  $('#startCall').disabled = true;
  $('#nextLine').disabled = false;
  $('#endCall').disabled = true;
  renderTranscript();
});
$('#nextLine').addEventListener('click', () => {
  step = Math.min(sample.length - 1, step + 1);
  $('#nextLine').disabled = step === sample.length - 1;
  $('#endCall').disabled = step !== sample.length - 1;
  renderTranscript();
});
$('#endCall').addEventListener('click', async () => {
  if (step < 0) return;
  $('#endCall').disabled = true;
  $('#nextLine').disabled = true;
  $('#callState').textContent = 'Ended';
  const input = {
    source: 'demo', sourceId: `sample-${Date.now()}`, account: 'Oakline Goods',
    rep: 'Demo BDR', title: 'Oakline Goods sample call', createdAt: new Date().toISOString(),
    durationMs: (step + 1) * 25000,
    transcript: sample.slice(0, step + 1).map((line, i) => `[0:${String(i * 25).padStart(2, '0')}] [${line.who}] ${line.text}`).join('\n')
  };
  try {
    if (backend) {
      const result = await request('/api/calls', 'POST', input);
      currentCall = result.call;
      await refresh();
    } else {
      currentCall = { ...input, id: crypto.randomUUID(), review: null, reviewVersion: 0 };
      state.calls.unshift(currentCall);
      state.outbox.unshift({ id: `ended:demo:${input.sourceId}`, type: 'call.ended', status: 'preview' });
      localSave(); render();
    }
    showReview(currentCall);
    $('#reviewForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (error) { $('#callState').textContent = error.message; }
});
$('#reviewForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!currentCall) return;
  const payload = {
    account: $('#account').value, rep: $('#rep').value, contactEmail: $('#contactEmail').value,
    issue: $('#issue').value, decisionMaker: $('#decisionMaker').value,
    objection: $('#objection').value, outcome: $('#outcome').value, nextStep: $('#nextStep').value
  };
  try {
    if (backend) {
      await request(`/api/calls/${currentCall.id}/approve`, 'POST', payload);
      await refresh();
    } else {
      Object.assign(currentCall, { account: payload.account, rep: payload.rep, contactEmail: payload.contactEmail,
        review: { ...payload, reviewedAt: new Date().toISOString() }, reviewVersion: currentCall.reviewVersion + 1 });
      state.outbox.unshift({ id: `approved:${currentCall.id}:${currentCall.reviewVersion}`, type: 'call.approved', status: 'preview' });
      localSave(); render();
    }
    $('#reviewMessage').textContent = state.makeConfigured ? 'Approved. Make received the call note.' : 'Approved. Make event is ready to connect.';
  } catch (error) { $('#reviewMessage').textContent = error.message; }
});
$('#sendReport').addEventListener('click', async () => {
  if (backend) {
    try { await request('/api/report/send', 'POST'); await refresh(); }
    catch (error) { $('#sendReport').textContent = error.message; }
  } else {
    const id = `report:${today()}`;
    if (!state.outbox.some(event => event.id === id)) state.outbox.unshift({ id, type: 'report.ready', status: 'preview' });
    localSave(); render();
  }
});

try {
  state = await request('/api/state');
  backend = true;
} catch {
  try { state = JSON.parse(localStorage.getItem(key)) || state; } catch { /* start clean */ }
}
render();
