import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api/client';
import { AlertItem } from '../types';
import { 
  AlertOctagon, ShieldAlert, CheckCircle2, UserCheck, 
  HelpCircle, RefreshCw, Filter, Search, ChevronRight, Eye, FileText
} from 'lucide-react';

export const AlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
    } catch (_) {} finally {
      setIsLoading(false);
    }
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
      alert(`Absence scan completed: ${res.new_alerts_count} new absence alerts identified.`);
      loadAlerts();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <AlertOctagon className="w-6 h-6 text-rose-500" />
            <span>Survey-Effort Normalized Movement Alerts</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Detects core-to-buffer movements, village proximity incursions, centroid shifts, and prolonged resident absences.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleScanAbsences}
            disabled={isScanning}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>Scan Prolonged Absences</span>
          </button>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="investigating">Investigating</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
          </select>
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl text-center text-slate-400 space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-200">No Active Movement Alerts</h3>
          <p className="text-xs">All individual tigers are within expected baseline territories.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 1 Col: Alerts Feed List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Alert Ticker ({alerts.length})
            </h3>
            <div className="space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
              {alerts.map((al) => {
                const isSelected = selectedAlert?.id === al.id;
                const isCrit = al.severity === 'CRITICAL';
                return (
                  <div
                    key={al.id}
                    onClick={() => setSelectedAlert(al)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer space-y-2 ${
                      isSelected
                        ? 'bg-slate-900 border-rose-500/80 shadow-lg'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        isCrit ? 'bg-rose-900/90 text-rose-200' : 'bg-amber-900/90 text-amber-200'
                      }`}>
                        {al.severity} • {al.alert_type.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {al.created_at.split('T')[0]}
                      </span>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-slate-100">{al.callsign} ({al.tiger_code})</div>
                      <p className="text-[11px] text-slate-300 line-clamp-2 mt-1">
                        {al.explanation.what_changed}
                      </p>
                    </div>

                    <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-900">
                      <span>Status: <strong className="text-slate-200 capitalize">{al.status}</strong></span>
                      <span className="text-emerald-400 font-semibold">{Math.round(al.confidence * 100)}% Conf.</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right 2 Cols: Comprehensive Explainability Evidence Panel */}
          {selectedAlert && (
            <div className="lg:col-span-2 glass-panel p-6 rounded-2xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl font-bold ${
                    selectedAlert.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  }`}>
                    ⚠️
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-100">{selectedAlert.callsign}</h3>
                      <span className="text-xs font-mono text-amber-400">({selectedAlert.tiger_code})</span>
                    </div>
                    <span className="text-xs text-slate-400">{selectedAlert.explanation.location} • Status: {selectedAlert.status}</span>
                  </div>
                </div>

                <span className={`text-xs font-bold px-3 py-1 rounded-xl ${
                  selectedAlert.severity === 'CRITICAL' ? 'bg-rose-950 text-rose-300 border border-rose-600' : 'bg-amber-950 text-amber-300 border border-amber-600'
                }`}>
                  {selectedAlert.severity} PRIORITY
                </span>
              </div>

              {/* Explainable AI Cards Grid */}
              <div className="space-y-3.5">
                {/* 1. What Changed */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                    What Changed
                  </span>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {selectedAlert.explanation.what_changed}
                  </p>
                </div>

                {/* 2. Why It Matters */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
                    Why It Matters
                  </span>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {selectedAlert.explanation.why_it_matters}
                  </p>
                </div>

                {/* 3. Supporting Evidence */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                    Supporting Sighting Evidence
                  </span>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {selectedAlert.explanation.supporting_evidence}
                  </p>
                </div>

                {/* 4. Survey Effort Normalization Context */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400">
                      Camera Trap Survey Effort Context
                    </span>
                    <span className="text-[10px] text-slate-400">Normalized Protocol</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {selectedAlert.explanation.survey_effort}.
                    {selectedAlert.explanation.is_effort_artifact && (
                      <span className="text-amber-400 font-medium ml-1">
                        (Note: Camera was deployed &lt;14 days ago; apparent expansion may reflect new camera grid placement).
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Action & Resolution Workflow */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Patrol Response / Resolution Notes
                  </label>
                  <input
                    type="text"
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="e.g., Turia forest guard patrol deployed to village boundary. Villagers informed."
                    className="w-full bg-slate-950 border border-slate-700 text-slate-100 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex flex-wrap gap-2.5 pt-1">
                  <button
                    onClick={() => handleUpdateStatus(selectedAlert.id, 'acknowledged')}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition border border-slate-700"
                  >
                    Acknowledge Alert
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedAlert.id, 'investigating')}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl transition"
                  >
                    Deploy Patrol & Investigate
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedAlert.id, 'resolved')}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition"
                  >
                    Mark Resolved
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedAlert.id, 'dismissed')}
                    className="px-3.5 py-2 bg-slate-950 text-slate-400 hover:text-slate-200 text-xs rounded-xl transition border border-slate-800 ml-auto"
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
