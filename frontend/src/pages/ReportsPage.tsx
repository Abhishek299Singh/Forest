import React from 'react';
import { FileSpreadsheet, Download, FileText, CheckCircle2, Shield, Calendar } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const handleDownload = (endpoint: string) => {
    window.open(`http://localhost:8000/api/v1/reports/${endpoint}`, '_blank');
  };

  const reports = [
    {
      id: 'tigers',
      title: 'Tiger Individual Census & Catalogue Report',
      description: 'Complete census record of resident, transient, and provisional individuals including sex, territory size, and flank stripe confidence.',
      format: 'CSV / Excel Compatible',
      endpoint: 'tigers/csv',
      icon: '🐅'
    },
    {
      id: 'alerts',
      title: 'Movement Deviations & Ecological Alerts Log',
      description: 'Historical audit log of all buffer zone incursions, village boundary proximities, territory centroid shifts, and survey-effort contexts.',
      format: 'CSV / Excel Compatible',
      endpoint: 'alerts/csv',
      icon: '🚨'
    },
    {
      id: 'survey',
      title: 'Camera Trap Survey Effort & Trap-Nights Protocol',
      description: 'Phase-IV monitoring protocol audit of active trap nights, deployment operational days, and downtime logs across all reserve stations.',
      format: 'CSV / Excel Compatible',
      endpoint: 'survey-effort/csv',
      icon: '📷'
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Title */}
      <div className="pb-4 border-b border-slate-800">
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
          <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
          <span>Scientific Reports & Field Data Export</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Export standardized wildlife monitoring datasets, tiger identification registries, and patrol audit records for National Tiger Conservation Authority (NTCA) reporting.
        </p>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reports.map((r) => (
          <div
            key={r.id}
            className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-4 hover:border-emerald-500/40 transition shadow-xl"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-slate-950 flex items-center justify-center text-2xl border border-slate-850">
                {r.icon}
              </div>
              <h3 className="text-sm font-bold text-slate-100">{r.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{r.description}</p>
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Format: <strong>{r.format}</strong></span>
                <span className="text-emerald-400 font-semibold">NTCA Ready</span>
              </div>
              <button
                onClick={() => handleDownload(r.endpoint)}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950"
              >
                <Download className="w-4 h-4" />
                <span>Export Dataset (.CSV)</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* NTCA Protocol Compliance Badge */}
      <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex items-center gap-4 text-xs text-slate-400">
        <Shield className="w-6 h-6 text-emerald-400 shrink-0" />
        <div>
          <span className="text-slate-200 font-bold block">NTCA / WII Protocol Standard Compliant</span>
          All data schemas strictly follow the National Tiger Monitoring Program Phase-IV camera-trapping guidelines.
        </div>
      </div>
    </div>
  );
};
