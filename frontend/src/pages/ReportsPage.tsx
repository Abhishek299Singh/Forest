import React, { useState } from 'react';
import { ApiClient } from '../api/client';
import { FileSpreadsheet, Download } from 'lucide-react';

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
      badge: 'Incident Ledger',
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
    <div className="p-4 space-y-4 max-w-[1600px] mx-auto text-xs">
      {/* Header */}
      <div className="pb-2 border-b border-[#232834]">
        <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
          <FileSpreadsheet className="w-4 h-4 text-slate-400" />
          <span>Statutory Reports & Data Export Center</span>
        </h2>
        <p className="text-[11px] text-slate-400">
          Generate official NTCA-standard CSV export datasets for tiger population census verification, patrol audits, and trap-night effort matrices.
        </p>
      </div>

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {reports.map((r) => (
          <div key={r.id} className="field-card p-3.5 space-y-3 flex flex-col justify-between text-xs">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-300 bg-[#181d26] px-1.5 py-0.2 rounded border border-[#232834]">
                  {r.badge}
                </span>
                <span className="text-slate-400 font-mono text-[10px]">CSV</span>
              </div>
              <h3 className="font-semibold text-slate-100 text-xs">
                {r.title}
              </h3>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                {r.description}
              </p>
            </div>

            <div className="pt-2.5 border-t border-[#232834] flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-400 truncate max-w-[150px]">{r.filename}</span>
              <button
                onClick={() => handleDownload(r.id, r.filename)}
                disabled={downloading === r.id}
                className="px-3 py-1 bg-[#181d26] hover:bg-[#232834] text-slate-200 text-xs font-medium rounded border border-[#2a3140] transition flex items-center gap-1.5"
              >
                {downloading === r.id ? (
                  <span>Exporting...</span>
                ) : (
                  <>
                    <Download className="w-3 h-3" />
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
