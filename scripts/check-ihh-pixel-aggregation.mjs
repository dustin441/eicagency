import assert from 'node:assert/strict';
import {
  IHH_PIXEL_RELIABLE_START,
  aggregateIhhPixelRows,
} from '../src/services/ihh-pixel-aggregation.ts';

assert.equal(IHH_PIXEL_RELIABLE_START, '2026-08-19');

const rows = [
  { date: '2026-08-18', cost: 100, conversions: 99, scheduled_appointments: 88 },
  { date: '2026-08-19', cost: 60, conversions: 3, scheduled_appointments: 1 },
  { date: '2026-08-19', cost: 40, conversions: 2, scheduled_appointments: 1 },
  { date: '2026-08-20', cost: 50, conversions: 0, scheduled_appointments: 0 },
];

const unavailable = aggregateIhhPixelRows(rows, '2026-08-01', '2026-08-18');
assert.deepEqual(unavailable, {
  coverage: 'none',
  trackingStart: IHH_PIXEL_RELIABLE_START,
  leads: null,
  scheduledAppointments: null,
  conversionRate: null,
  costPerLead: null,
  costPerScheduledAppointment: null,
  trackingSpend: null,
  daily: [
    { label: '2026-08-18', leads: null, scheduledAppointments: null },
  ],
});

const partial = aggregateIhhPixelRows(rows, '2026-08-18', '2026-08-20');
assert.deepEqual(partial, {
  coverage: 'partial',
  trackingStart: IHH_PIXEL_RELIABLE_START,
  leads: 5,
  scheduledAppointments: 2,
  conversionRate: 40,
  costPerLead: 30,
  costPerScheduledAppointment: 75,
  trackingSpend: 150,
  daily: [
    { label: '2026-08-18', leads: null, scheduledAppointments: null },
    { label: '2026-08-19', leads: 5, scheduledAppointments: 2 },
    { label: '2026-08-20', leads: 0, scheduledAppointments: 0 },
  ],
});

const full = aggregateIhhPixelRows(rows, '2026-08-19', '2026-08-20');
assert.equal(full.coverage, 'full');
assert.equal(full.leads, 5);
assert.equal(full.scheduledAppointments, 2);
assert.equal(full.trackingSpend, 150);
assert.deepEqual(full.daily, [
  { label: '2026-08-19', leads: 5, scheduledAppointments: 2 },
  { label: '2026-08-20', leads: 0, scheduledAppointments: 0 },
]);

const zeroDenominators = aggregateIhhPixelRows([
  { date: '2026-08-21', cost: 75, conversions: 0, scheduled_appointments: 0 },
], '2026-08-21', '2026-08-21');
assert.deepEqual({
  conversionRate: zeroDenominators.conversionRate,
  costPerLead: zeroDenominators.costPerLead,
  costPerScheduledAppointment: zeroDenominators.costPerScheduledAppointment,
}, {
  conversionRate: null,
  costPerLead: null,
  costPerScheduledAppointment: null,
});

console.log('IHH Meta pixel aggregation checks passed');
