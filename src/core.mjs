import { randomUUID } from 'node:crypto';

export const TZ = 'Africa/Johannesburg';

export function johannesburgParts(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(value);
  const get = name => parts.find(part => part.type === name)?.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

const clean = (value, max = 2000) => String(value ?? '').trim().slice(0, max);

export function createCall(input) {
  const sourceId = clean(input.sourceId, 120);
  const account = clean(input.account, 160);
  if (!sourceId || !account) throw new Error('A recording ID and account name are required.');
  const createdAt = new Date(input.createdAt || Date.now());
  if (Number.isNaN(createdAt.getTime())) throw new Error('Invalid call date.');
  const durationMs = Math.max(0, Number(input.durationMs) || 0);
  return {
    id: randomUUID(), source: clean(input.source || 'demo', 40), sourceId,
    account, rep: clean(input.rep || 'Demo BDR', 100),
    contact: clean(input.contact, 120), contactEmail: clean(input.contactEmail, 160),
    hubspotContactId: clean(input.hubspotContactId, 80),
    title: clean(input.title || `${account} call`, 180),
    createdAt: createdAt.toISOString(), endedAt: new Date(createdAt.getTime() + durationMs).toISOString(), durationMs,
    transcript: clean(input.transcript, 100000), parleyBrief: clean(input.parleyBrief, 12000),
    review: null, reviewVersion: 0
  };
}

export function reviewCall(call, input) {
  const outcomes = new Set(['meeting_booked', 'follow_up', 'not_fit', 'no_answer', 'other']);
  const outcome = clean(input.outcome, 40);
  if (!outcomes.has(outcome)) throw new Error('Choose a valid outcome.');
  const review = {
    outcome, issue: clean(input.issue, 1200), objection: clean(input.objection, 600),
    decisionMaker: clean(input.decisionMaker, 300), nextStep: clean(input.nextStep, 1200),
    reviewedAt: new Date().toISOString()
  };
  if (outcome === 'meeting_booked' && !review.nextStep) throw new Error('Add the agreed meeting or next step.');
  call.review = review;
  call.reviewVersion += 1;
  return call;
}

export function reportFor(calls, date = johannesburgParts().date) {
  const todays = calls.filter(call => johannesburgParts(new Date(call.endedAt || call.createdAt)).date === date);
  const approved = todays.filter(call => call.review);
  const objections = {};
  for (const call of approved) {
    if (call.review.objection) {
      const label = call.review.objection.toLowerCase();
      objections[label] = (objections[label] || 0) + 1;
    }
  }
  const report = {
    date, timeZone: TZ, generatedAt: new Date().toISOString(),
    capturedCalls: todays.length, reviewedCalls: approved.length,
    pendingReview: todays.length - approved.length,
    meetingsBooked: approved.filter(call => call.review.outcome === 'meeting_booked').length,
    followUps: approved.filter(call => call.review.outcome === 'follow_up').length,
    notFit: approved.filter(call => call.review.outcome === 'not_fit').length,
    objections: Object.entries(objections).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    handoffs: approved.filter(call => call.review.outcome === 'meeting_booked').map(call => ({
      account: call.account, rep: call.rep, issue: call.review.issue,
      decisionMaker: call.review.decisionMaker, nextStep: call.review.nextStep
    })),
    dials: null,
    dialsNote: 'Dial totals need the dialer or CRM. A recording count is not a dial count.'
  };
  report.message = formatReport(report);
  return report;
}

export function formatReport(report) {
  const handoffs = report.handoffs.length
    ? report.handoffs.map(item => `${item.account}: ${item.nextStep || 'next step to confirm'}`).join('\n')
    : 'None confirmed.';
  const objections = report.objections.length
    ? report.objections.map(item => `${item.name} (${item.count})`).join(', ')
    : 'None recorded in approved notes.';
  return [
    `Bustem BDR report for ${report.date} (Johannesburg)`,
    `Calls captured: ${report.capturedCalls}. Rep reviewed: ${report.reviewedCalls}. Awaiting review: ${report.pendingReview}.`,
    `Meetings booked: ${report.meetingsBooked}. Follow ups: ${report.followUps}. Not a fit: ${report.notFit}.`,
    `Objections: ${objections}`,
    `Meeting handoffs:\n${handoffs}`,
    'Dial totals: unavailable until the dialer is connected.'
  ].join('\n');
}

export function eventFor(type, call, report) {
  if (type === 'report.ready') {
    return { id: `report:${report.date}`, type, createdAt: new Date().toISOString(), payload: report, status: 'pending', attempts: 0 };
  }
  const base = {
    callId: call.id, recordingId: call.sourceId, source: call.source, account: call.account,
    rep: call.rep, contact: call.contact, contactEmail: call.contactEmail,
    hubspotContactId: call.hubspotContactId, endedAt: call.endedAt,
    durationMs: call.durationMs
  };
  return {
    id: type === 'call.ended' ? `ended:${call.source}:${call.sourceId}` : `approved:${call.id}:${call.reviewVersion}`,
    type, createdAt: new Date().toISOString(),
    payload: type === 'call.approved' ? { ...base, ...call.review } : base,
    status: 'pending', attempts: 0
  };
}
