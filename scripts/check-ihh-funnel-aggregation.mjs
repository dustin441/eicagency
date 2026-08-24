import assert from 'node:assert/strict';
import { aggregateIhhFunnelRows, ihhArizonaDateLabel, ihhArizonaRangeBounds } from '../src/services/ihh-funnel-aggregation.ts';

const rows = [
  { contact_key: 'a', lead_at: '2026-08-01T10:00:00Z', quiz_taker: true, appointment_scheduled: true },
  { contact_key: 'b', lead_at: '2026-08-01T11:00:00Z', quiz_taker: true, appointment_scheduled: false },
  { contact_key: 'c', lead_at: '2026-08-02T09:00:00Z', quiz_taker: true, appointment_scheduled: true },
  { contact_key: 'ignored', lead_at: '2026-08-02T12:00:00Z', quiz_taker: false, appointment_scheduled: true },
];

const current = aggregateIhhFunnelRows(rows, 300);
assert.deepEqual(
  {
    quizTakers: current.quizTakers,
    scheduledAppointments: current.scheduledAppointments,
    conversionRate: current.conversionRate,
    costPerQuizTaker: current.costPerQuizTaker,
    costPerScheduledAppointment: current.costPerScheduledAppointment,
  },
  {
    quizTakers: 3,
    scheduledAppointments: 2,
    conversionRate: (2 / 3) * 100,
    costPerQuizTaker: 100,
    costPerScheduledAppointment: 150,
  }
);
assert.deepEqual(current.daily, [
  { label: '2026-08-01', quizTakers: 2, scheduledAppointments: 1 },
  { label: '2026-08-02', quizTakers: 1, scheduledAppointments: 1 },
]);

const previous = aggregateIhhFunnelRows([
  { contact_key: 'p', lead_at: '2026-07-31T23:00:00Z', quiz_taker: true, appointment_scheduled: false },
], 80);
assert.equal(previous.quizTakers, 1);
assert.equal(previous.scheduledAppointments, 0);
assert.equal(previous.conversionRate, 0);
assert.equal(previous.costPerScheduledAppointment, null);
assert.notDeepEqual(current, previous);

const empty = aggregateIhhFunnelRows([], 250);
assert.deepEqual(empty, {
  quizTakers: 0,
  scheduledAppointments: 0,
  conversionRate: null,
  costPerQuizTaker: null,
  costPerScheduledAppointment: null,
  daily: [],
});

assert.equal(ihhArizonaDateLabel('2026-08-02T05:30:00Z'), '2026-08-01');
assert.deepEqual(ihhArizonaRangeBounds('2026-08-01', '2026-08-02'), {
  start: '2026-08-01T07:00:00.000Z',
  endExclusive: '2026-08-03T07:00:00.000Z',
});

console.log('IHH funnel aggregation checks passed');
