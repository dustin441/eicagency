import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const directory = new URL('./', import.meta.url);
const dashboards = readdirSync(directory).filter(name => name.endsWith('DashboardClient.tsx'));
let checked = 0;
for (const file of dashboards) {
 const source = readFileSync(new URL(file, directory), 'utf8');
 const component = source.slice(Math.max(0, source.lastIndexOf('export default function')));
 const readout = component.search(/<(?:WeeklyExecutiveSummary|WeeklyNotes|WeeklyReadoutCard|SpartacoWeeklyNotes)\b/);
 const pacing = component.search(/<(?:BudgetPacing|AuritBudgetPacing|BudgetPacingCard)\b/);
 if (readout < 0 || pacing < 0) continue;
 checked++;
 test(`${file}: weekly AI readout precedes budget pacing`, () => {
  assert.ok(readout < pacing, `${file} renders budget pacing before the weekly readout`);
 });
}
test('ordering contract covers every existing paired dashboard', () => assert.ok(checked >= 10, `Expected at least ten existing paired dashboards, found ${checked}`));
test('preserves intentionally scoped or hidden readouts rather than inventing text', () => {
 const champagne=readFileSync(new URL('./ChampagneDashboardClient.tsx',directory),'utf8');
 const goodgame=readFileSync(new URL('./GoodGameDashboardClient.tsx',directory),'utf8');
 assert.ok(champagne.includes('{weeklyReadout && <WeeklyExecutiveSummary'));
 assert.ok(goodgame.includes('{!isFootTraffic && <WeeklyExecutiveSummary'));
});
