import test from 'node:test';
import assert from 'node:assert/strict';
import { createCall, johannesburgParts, reportFor, reviewCall } from '../src/core.mjs';

test('Johannesburg date handles a UTC day boundary', () => {
  assert.equal(johannesburgParts(new Date('2026-10-30T22:30:00Z')).date, '2026-10-31');
  const call = createCall({ sourceId: 'cross-midnight', account: 'Example Brand', createdAt: '2026-10-30T21:59:00Z', durationMs: 120000 });
  assert.equal(reportFor([call], '2026-10-31').capturedCalls, 1);
});

test('daily meeting count requires rep approval', () => {
  const call = createCall({ sourceId: 'rec-1', account: 'Example Brand', createdAt: '2026-10-31T09:00:00Z' });
  let report = reportFor([call], '2026-10-31');
  assert.equal(report.capturedCalls, 1);
  assert.equal(report.meetingsBooked, 0);
  assert.equal(report.pendingReview, 1);
  assert.equal(report.dials, null);
  reviewCall(call, { outcome: 'meeting_booked', issue: 'Fake checkout', nextStep: 'Confirmed meeting on Tuesday' });
  report = reportFor([call], '2026-10-31');
  assert.equal(report.meetingsBooked, 1);
  assert.equal(report.pendingReview, 0);
  assert.equal(report.handoffs[0].account, 'Example Brand');
});

test('meeting cannot be approved without a next step', () => {
  const call = createCall({ sourceId: 'rec-2', account: 'Example Brand' });
  assert.throws(() => reviewCall(call, { outcome: 'meeting_booked' }), /next step/);
});
