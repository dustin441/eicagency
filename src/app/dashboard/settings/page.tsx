import React from 'react';
import {
  Database, Shield, Bell, User, Plug, CheckCircle2, AlertCircle,
} from 'lucide-react';

const DATA_CONNECTIONS = [
  { name: 'Google Ads',        table: 'google_campaigns',          rows: 6135,  status: 'connected' },
  { name: 'Meta Ads',          table: 'meta_campaigns',            rows: 7124,  status: 'connected' },
  { name: 'LinkedIn Ads',      table: 'linkedin_campaign_data',    rows: 4636,  status: 'connected' },
  { name: 'Meta Ad Sets',      table: 'meta_adset',                rows: 4809,  status: 'connected' },
  { name: 'Meta Creatives',    table: 'meta_ads_creatives',        rows: 36268, status: 'connected' },
  { name: 'Google Search Ads', table: 'google_search_ads_creatives', rows: 3135, status: 'connected' },
  { name: 'Google Display',    table: 'google_display_creatives',  rows: 2467,  status: 'connected' },
  { name: 'Asset Performance', table: 'Asset Performance',         rows: 62009, status: 'connected' },
  { name: 'Geographic (State)', table: 'google_geo_state',         rows: 41296, status: 'connected' },
  { name: 'Geographic (City)',  table: 'google_geo_city',          rows: 529324, status: 'connected' },
  { name: 'Enrollment (MQL)',  table: 'enrollment',                rows: 14907, status: 'connected' },
  { name: 'Enrollment (Won)',  table: 'enrollment_won',            rows: 7512,  status: 'connected' },
  { name: 'Calls',             table: 'calls',                     rows: 8767,  status: 'connected' },
  { name: 'Call Tracking',     table: 'call_google',               rows: 1235,  status: 'connected' },
  { name: 'Ad Change History', table: 'ad_change_history',         rows: 8215,  status: 'connected' },
  { name: 'Budgets',           table: 'budgets',                   rows: 4,     status: 'connected' },
  { name: 'LinkedIn Ads (MQL)', table: 'linkedin_ads_creatives',   rows: 533,   status: 'connected' },
  { name: 'ClickUp Tasks',     table: 'clickup_tasks',             rows: 596,   status: 'connected' },
  { name: 'ClickUp Comments',  table: 'clickup_comments',         rows: 1472,   status: 'connected' },
  { name: 'Master Performance', table: 'master_marketing_performance', rows: 0,  status: 'connected' },
];

function fmtRows(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1000).toFixed(0)}k`;
  return n.toString();
}

export default function SettingsPage() {
  const totalRows = DATA_CONNECTIONS.reduce((acc, c) => acc + c.rows, 0);
  const connected = DATA_CONNECTIONS.filter(c => c.status === 'connected').length;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-brand-dark tracking-tight">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your data connections, team access, and preferences</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Data Sources',    value: connected,             icon: Database, color: 'text-brand-forest' },
          { label: 'Total Records',   value: fmtRows(totalRows),    icon: Plug,     color: 'text-blue-600' },
          { label: 'Team Members',    value: '—',                   icon: User,     color: 'text-purple-600' },
          { label: 'Alerts Active',   value: '—',                   icon: Bell,     color: 'text-brand-orange' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
            <div className={`p-2 rounded-xl bg-gray-50 w-fit mb-4 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold text-brand-dark tabular-nums">{value}</div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Data Connections */}
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex items-center gap-3">
          <div className="p-2 bg-gray-50 rounded-xl text-brand-forest">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-brand-dark">Supabase Data Connections</h2>
            <p className="text-sm text-gray-400 mt-0.5">{connected} of {DATA_CONNECTIONS.length} tables connected · {fmtRows(totalRows)} total rows</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Data Source', 'Table', 'Records', 'Status'].map(h => (
                  <th key={h} className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DATA_CONNECTIONS.map((c, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-brand-dark">{c.name}</td>
                  <td className="px-6 py-4">
                    <code className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg font-mono">{c.table}</code>
                  </td>
                  <td className="px-6 py-4 text-gray-600 tabular-nums font-medium">{fmtRows(c.rows)}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600">
                      <CheckCircle2 className="w-3 h-3" />
                      Connected
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Placeholder sections */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Team */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gray-50 rounded-xl text-purple-600"><User className="w-5 h-5" /></div>
            <h2 className="text-lg font-bold text-brand-dark">Team Access</h2>
          </div>
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <AlertCircle className="w-4 h-4 text-gray-400 shrink-0" />
            <p className="text-sm text-gray-400">Team management coming soon. Contact your admin to add or remove users.</p>
          </div>
        </div>

        {/* Security */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gray-50 rounded-xl text-brand-forest"><Shield className="w-5 h-5" /></div>
            <h2 className="text-lg font-bold text-brand-dark">Security & Auth</h2>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Authentication', value: 'Supabase Auth (Email / Password)', ok: true },
              { label: 'Session Management', value: 'Cookie-based SSR sessions', ok: true },
              { label: 'Row Level Security', value: 'Enabled on platform tables', ok: true },
              { label: 'API Key', value: 'Service role (server-only)', ok: true },
            ].map(({ label, value, ok }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm font-medium text-gray-600">{label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{value}</span>
                  {ok && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Notifications placeholder */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gray-50 rounded-xl text-brand-orange"><Bell className="w-5 h-5" /></div>
          <h2 className="text-lg font-bold text-brand-dark">Notifications & Alerts</h2>
        </div>
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <AlertCircle className="w-4 h-4 text-gray-400 shrink-0" />
          <p className="text-sm text-gray-400">Budget pacing alerts, anomaly detection, and weekly digest emails — coming soon.</p>
        </div>
      </div>
    </div>
  );
}
