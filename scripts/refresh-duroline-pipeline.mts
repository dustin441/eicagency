import { existsSync } from 'node:fs';

// Run from the repository root with:
// node --conditions=react-server --import tsx scripts/refresh-duroline-pipeline.mts [--dry-run]
// All secrets are loaded from the environment, never committed to this script.
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const { collectDurolinePipelineSnapshot, refreshDurolinePipelineSnapshot } = await import('../src/services/duroline-pipeline-sync.ts');
if (process.argv.includes('--dry-run')) {
  const snapshot = await collectDurolinePipelineSnapshot();
  console.log(JSON.stringify({
    dryRun: true,
    capturedAt: snapshot.capturedAt,
    leads: snapshot.leads.length,
    quality: snapshot.leads.filter(x => x.quality).length,
    deals: snapshot.deals.length,
    dealStages: Object.fromEntries(snapshot.stageDefinitions.map(s => [s.name, snapshot.deals.filter(x => x.stageId === s.id).length])),
    matchedLeads: snapshot.leads.filter(x => x.matchStatus === 'matched').length,
    ambiguousLeads: snapshot.leads.filter(x => x.matchStatus === 'ambiguous').length,
  }, null, 2));
} else {
  console.log(JSON.stringify(await refreshDurolinePipelineSnapshot(), null, 2));
}
