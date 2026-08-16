import React, { useState } from 'react';
import { ApiClient } from '../api/client';
import { FileSpreadsheet, Download, Check } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (type: string, filename: string) => {
    setDownloading(type);
    try {
      let csvContent = '';
      if (type === 'tigers') {
        csvContent = await ApiClient.exportTigersCSV();
      } else if (type === 'alerts') {
        csvContent = await ApiClient.exportAlertsCSV();
      } else if (type === 'effort') {
        csvContent = await ApiClient.exportEffortCSV();
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    } finally {
      setDownloading(null);
    }
  };

  const reports = [
    {
      id: 'tigers',
      title: 'Individual Tiger Registry & Flank Sighting Ledger',
      description: 'Comprehensive table of all resident, transient, and provisional individuals, bilateral flank capture counts, and home-range area (MCP 95%).',
      filename: `pench_tiger_registry_${new Date().toISOString().split('T')[0]}.csv`,
      badge: 'NTCA Phase-IV Format',
    },
    {
      id: 'alerts',
      title: 'Ecological Movement Deviations & Alert Log',
      description: 'Record of all generated buffer zone incursions, village boundary proximity alerts, survey-effort metrics, and patrol resolution notes.',
      filename: `pench_movement_alerts_${new Date().toISOString().split('T')[0]}.csv`,
      badge: 'Incident Log',
    },
    {
      id: 'effort',
      title: 'Camera Trap Survey Effort & Trap-Night Ledger',
      description: 'Station-by-station deployment records, operational dates, active trap-night totals, downtime days, and cumulative captures.',
      filename: `pench_survey_effort_${new Date().toISOString().split('T')[0]}.csv`,
      badge: 'Survey Matrix',
    },
  ];

  return (
    <div className="p-5 space-y-5 max-w-[1500px] mx-auto">
      {/* Header */}
      <div className="pb-3 border-b border-[#233044]">
        <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
          <span>Statutory Reports & Data Export Portal</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Generate and export official NTCA-standard CSV reports for tiger census verification, patrol audits, and camera trap effort matrices.
        </p>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {reports.map((r) => (
          <div key={r.id} className="field-card p-4 space-y-3 flex flex-col justify-between text-xs">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-emerald-400 bg-[#162032] px-2 py-0.5 rounded border border-[#233044]">
                  {r.badge}
                </span>
                <span className="text-slate-400 font-mono text-[10px]">CSV</span>
              </div>
              <h3 className="font-bold text-slate-100 text-sm leading-snug">
                {r.title}
              </h3>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                {r.description}
              </p>
            </div>

            <div className="pt-3 border-t border-[#1a2537] flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-400 truncate max-w-[160px]">{r.filename}</span>
              <button
                onClick={() => handleDownload(r.id, r.filename)}
                disabled={downloading === r.id}
                className="px-3 py-1.5 bg-[#1b3d2b] hover:bg-[#234e37] text-emerald-200 text-xs font-semibold rounded border border-[#2d6144] transition flex items-center gap-1.5"
              >
                {downloading === r.id ? (
                  <span>Exporting...</span>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Download CSV</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
