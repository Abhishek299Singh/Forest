import React, { useState, useEffect } from 'react';
import { useSync } from '../context/SyncContext';
import { ApiClient } from '../api/client';
import { 
  RefreshCw, Wifi, WifiOff, HardDrive, CheckCircle2, 
  AlertTriangle, ArrowUpCircle, ArrowDownCircle, ShieldCheck, Database
} from 'lucide-react';

export const SyncPage: React.FC = () => {
  const { status, toggleConnectivity, triggerSyncNow } = useSync();
  const [outboxItems, setOutboxItems] = useState<any[]>([]);
  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadData = async () => {
    try {
      const [outbox, logs] = await Promise.all([
        ApiClient.getOutboxItems(),
        ApiClient.getSyncLogs(),
      ]);
      setOutboxItems(outbox);
      setSyncLogs(logs);
    } catch (_) {}
  };

  useEffect(() => {
    loadData();
  }, [status]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    await triggerSyncNow();
    await loadData();
    setIsSyncing(false);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <RefreshCw className="w-6 h-6 text-emerald-400" />
            <span>Offline-First Synchronization Hub</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Outbox queueing, local SQLite mutation cache, central PostgreSQL reconciliation, and conflict resolution.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => toggleConnectivity(!status.is_online)}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition flex items-center gap-2 ${
              status.is_online
                ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-600/60 hover:bg-emerald-800/70'
                : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
            }`}
          >
            {status.is_online ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            <span>{status.is_online ? 'Connected to Central Server' : 'Simulate Connect Online'}</span>
          </button>

          {status.is_online && (
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-950"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Sync All Changes Now</span>
            </button>
          )}
        </div>
      </div>

      {/* Sync Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-2xl space-y-1">
          <span className="text-xs text-slate-400 font-semibold uppercase">Network Mode</span>
          <div className="text-lg font-bold flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${status.is_online ? 'bg-emerald-500' : 'bg-blue-500'}`}></span>
            <span className={status.is_online ? 'text-emerald-300' : 'text-blue-300'}>
              {status.is_online ? 'Online Cloud' : 'Offline Field Laptop'}
            </span>
          </div>
          <div className="text-[11px] text-slate-400">Device: {status.device_id}</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl space-y-1">
          <span className="text-xs text-slate-400 font-semibold uppercase">Pending Uploads</span>
          <div className="text-2xl font-bold text-amber-400">
            {status.pending_uploads}
          </div>
          <div className="text-[11px] text-slate-400">Outbox mutations queued</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl space-y-1">
          <span className="text-xs text-slate-400 font-semibold uppercase">Pending Downloads</span>
          <div className="text-2xl font-bold text-slate-200">
            {status.pending_downloads}
          </div>
          <div className="text-[11px] text-slate-400">Incoming model/catalogue updates</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl space-y-1">
          <span className="text-xs text-slate-400 font-semibold uppercase">Last Reconciled</span>
          <div className="text-sm font-bold text-slate-200 truncate mt-1">
            {status.last_synced_at ? status.last_synced_at.replace('T', ' ').slice(0, 19) : 'Just Now'}
          </div>
          <div className="text-[11px] text-emerald-400">Zero data collisions</div>
        </div>
      </div>

      {/* Outbox Queue & Architecture Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Outbox Table */}
        <div className="lg:col-span-2 glass-panel p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>Local Outbox Queue Table</span>
            </h3>
            <span className="text-xs text-slate-400">Automatic retry on connectivity</span>
          </div>

          <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3">Entity</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Device</th>
                  <th className="p-3">Created</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 text-slate-300">
                {outboxItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400">
                      Outbox queue is currently empty. All local changes are synchronized.
                    </td>
                  </tr>
                ) : (
                  outboxItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-900/40">
                      <td className="p-3 font-semibold text-slate-100">{item.entity_type} ({item.entity_id.slice(0, 8)})</td>
                      <td className="p-3 uppercase font-bold text-amber-400 text-[10px]">{item.action}</td>
                      <td className="p-3 font-mono text-slate-400 text-[11px]">{item.device_id}</td>
                      <td className="p-3 text-slate-400">{item.created_at?.replace('T', ' ').slice(0, 19)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize ${
                          item.sync_status === 'synced' ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-300'
                        }`}>
                          {item.sync_status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 1 Col: Conflict Resolution Rules */}
        <div className="space-y-4">
          <div className="glass-panel p-5 rounded-2xl space-y-3">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Conflict Resolution Policy</span>
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-300">
              <li className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0"></span>
                <span><strong>Immutable Events:</strong> Raw captures and tiger detections are immutable events that are appended without overwriting.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0"></span>
                <span><strong>Versioned Metadata:</strong> Callsign, station coordinates, and notes use incrementing version timestamps.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0"></span>
                <span><strong>Human Review Precedence:</strong> Biologist review decisions take precedence over automated AI classifications.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
