import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api/client';
import { AlertItem } from '../types';
import { AlertOctagon, RefreshCw, CheckCircle2 } from 'lucide-react';

export const AlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  const loadAlerts = async () => {
    try {
      const data = await ApiClient.getAlerts({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        severity: severityFilter !== 'all' ? severityFilter : undefined,
      });
      setAlerts(data);
      if (data.length > 0 && !selectedAlert) {
        setSelectedAlert(data[0]);
      }
    } catch (_) {}
  };

  useEffect(() => {
    loadAlerts();
  }, [statusFilter, severityFilter]);

  const handleUpdateStatus = async (alertId: string, status: string) => {
    try {
      await ApiClient.updateAlertStatus(alertId, status, resolutionNotes || undefined);
      setResolutionNotes('');
      loadAlerts();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleScanAbsences = async () => {
    setIsScanning(true);
    try {
      const res = await ApiClient.scanAbsences();
      alert(`Absence audit completed: ${res.new_alerts_count} absence notifications recorded.`);
      loadAlerts();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="p-5 space-y-5 max-w-[1500px] mx-auto">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#233044]">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-rose-500" />
            <span>Survey-Effort Normalized Movement Alert Ledger</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Automated detection of buffer zone incursions, village fringe proximities, territory shifts, and resident tiger absences.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <button
            onClick={handleScanAbsences}
            disabled={isScanning}
            className="px-3 py-1.5 bg-[#1e293b] hover:bg-[#28384f] text-slate-200 rounded border border-[#334155] transition flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>Audit Absence Days</span>
          </button>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#0b111e] border border-[#233044] text-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Incident Statuses</option>
            <option value="active">Active</option>
            <option value="investigating">Patrol Dispatched</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-[#0b111e] border border-[#233044] text-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Severities</option>
            <option value="CRITICAL">Critical Priority</option>
            <option value="HIGH">High Priority</option>
            <option value="MEDIUM">Medium Priority</option>
          </select>
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="field-card p-10 text-center text-slate-400 text-xs space-y-1">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
          <p className="font-semibold text-slate-200">No Active Movement Alerts</p>
          <p>All resident individuals are within historical baseline ranges.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left 1 Col: Alert Ledger */}
          <div className="space-y-2 text-xs">
            <h3 className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
              Alerts Ledger ({alerts.length})
            </h3>
            <div className="space-y-1.5 max-h-[700px] overflow-y-auto pr-1">
              {alerts.map((al) => {
                const isSelected = selectedAlert?.id === al.id;
                const isCrit = al.severity === 'CRITICAL';
                return (
                  <div
                    key={al.id}
                    onClick={() => setSelectedAlert(al)}
                    className={`p-3 rounded border transition cursor-pointer space-y-1.5 ${
                      isSelected
                        ? 'bg-[#1b2536] border-rose-500/70'
                        : 'bg-[#121a29] border-[#233044] hover:bg-[#162236]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                        isCrit ? 'bg-rose-900/60 text-rose-300 border border-rose-700' : 'bg-amber-900/60 text-amber-300 border border-amber-700'
                      }`}>
                        {al.severity} • {al.alert_type.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {al.created_at.split('T')[0]}
                      </span>
                    </div>

                    <div>
                      <div className="font-bold text-slate-100">{al.callsign} ({al.tiger_code})</div>
                      <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5 leading-relaxed">
                        {al.explanation.what_changed}
                      </p>
                    </div>

                    <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-[#1a2537]">
                      <span>Status: <strong className="text-slate-200 capitalize">{al.status}</strong></span>
                      <span className="text-emerald-400 font-mono">{Math.round(al.confidence * 100)}% match</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right 2 Cols: Scientific Explainability & Patrol Action Card */}
          {selectedAlert && (
            <div className="lg:col-span-2 field-card p-4 space-y-4 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#233044]">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-100">{selectedAlert.callsign}</h3>
                    <span className="font-mono text-amber-400 text-xs">({selectedAlert.tiger_code})</span>
                  </div>
                  <span className="text-slate-400 text-[11px]">{selectedAlert.explanation.location} • Status: {selectedAlert.status}</span>
                </div>

                <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                  selectedAlert.severity === 'CRITICAL' ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                }`}>
                  {selectedAlert.severity} PRIORITY
                </span>
              </div>

              {/* Explainability Cards */}
              <div className="space-y-2.5">
                <div className="bg-[#0b111e] p-3 rounded border border-[#233044] space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                    1. Observed Movement Deviation
                  </span>
                  <p className="text-slate-200 leading-relaxed">
                    {selectedAlert.explanation.what_changed}
                  </p>
                </div>

                <div className="bg-[#0b111e] p-3 rounded border border-[#233044] space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
                    2. Ecological & Conflict Significance
                  </span>
                  <p className="text-slate-200 leading-relaxed">
                    {selectedAlert.explanation.why_it_matters}
                  </p>
                </div>

                <div className="bg-[#0b111e] p-3 rounded border border-[#233044] space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    3. Supporting Camera Trap Evidence
                  </span>
                  <p className="text-slate-200 leading-relaxed">
                    {selectedAlert.explanation.supporting_evidence}
                  </p>
                </div>

                <div className="bg-[#0b111e] p-3 rounded border border-[#233044] space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                    4. Survey Effort Baseline Context
                  </span>
                  <p className="text-slate-200 leading-relaxed">
                    {selectedAlert.explanation.survey_effort}.
                    {selectedAlert.explanation.is_effort_artifact && (
                      <span className="text-amber-400 font-medium ml-1">
                        (Camera deployed &lt;14 days ago; change may reflect new trap placement).
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Patrol Actions */}
              <div className="pt-3 border-t border-[#233044] space-y-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Patrol Response / Incident Resolution Log
                  </label>
                  <input
                    type="text"
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="e.g. Range patrol dispatched to Turia buffer border. Livestock advisory issued."
                    className="w-full bg-[#0b111e] border border-[#233044] text-slate-100 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500 font-sans"
                  />
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={() => handleUpdateStatus(selectedAlert.id, 'acknowledged')}
                    className="px-3 py-1.5 bg-[#1e293b] hover:bg-[#28384f] text-slate-200 text-xs rounded border border-[#334155] transition"
                  >
                    Acknowledge
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedAlert.id, 'investigating')}
                    className="px-3 py-1.5 bg-[#3d2c12] hover:bg-[#523c1a] text-amber-300 text-xs rounded border border-[#61471b] transition"
                  >
                    Dispatch Patrol
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedAlert.id, 'resolved')}
                    className="px-3 py-1.5 bg-[#1b3d2b] hover:bg-[#234e37] text-emerald-200 text-xs rounded border border-[#2d6144] transition"
                  >
                    Resolve Incident
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedAlert.id, 'dismissed')}
                    className="px-3 py-1.5 bg-[#0b111e] text-slate-400 hover:text-slate-200 text-xs rounded border border-[#233044] ml-auto transition"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
