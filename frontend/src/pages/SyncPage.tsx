import React, { useEffect, useState } from 'react';
import { useSync } from '../context/SyncContext';
import { ApiClient } from '../api/client';
import { RefreshCw, Wifi, WifiOff, HardDrive } from 'lucide-react';

export const SyncPage: React.FC = () => {
  const { status, toggleConnectivity, triggerSyncNow } = useSync();
  const [outboxItems, setOutboxItems] = useState<any[]>([]);

  const loadOutbox = async () => {
    try {
      const items = await ApiClient.getOutbox();
      setOutboxItems(items);
    } catch (_) {}
  };

  useEffect(() => {
    loadOutbox();
  }, [status]);

  const isSyncing = status.sync_status === 'syncing';

  return (
    <div className="p-5 space-y-5 max-w-[1500px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#233044]">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-emerald-400" />
            <span>Offline-First Synchronization Hub</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage field mutations queued in local SQLite outbox and reconcile with Central PostGIS server when network connectivity is established.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => toggleConnectivity(!status.is_online)}
            className={`px-3 py-1.5 rounded text-xs font-semibold border transition flex items-center gap-2 ${
              status.is_online
                ? 'bg-[#1b3d2b] border-[#2d6144] text-emerald-300'
                : 'bg-[#1e293b] border-[#334155] text-slate-300'
            }`}
          >
            {status.is_online ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4 text-slate-400" />}
            <span>{status.is_online ? 'Central Server Online' : 'Offline Field Mode'}</span>
          </button>

          {status.is_online && (
            <button
              onClick={() => triggerSyncNow()}
              disabled={isSyncing}
              className="px-3 py-1.5 bg-[#1b3d2b] hover:bg-[#234e37] text-emerald-200 text-xs font-semibold rounded border border-[#2d6144] transition flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Reconciling...' : 'Sync Outbox Now'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Sync Telemetry Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="field-card p-3.5 space-y-1">
          <span className="text-slate-400 text-[11px]">Field Laptop ID</span>
          <div className="font-bold text-slate-100 font-mono text-sm">{status.device_id || 'TURIA-HQ-01'}</div>
          <span className="text-[10px] text-emerald-400 font-mono">SQLite Local DB</span>
        </div>

        <div className="field-card p-3.5 space-y-1">
          <span className="text-slate-400 text-[11px]">Pending Uploads</span>
          <div className="font-bold text-amber-400 font-mono text-sm">{status.pending_uploads} records</div>
          <span className="text-[10px] text-slate-400">Local Outbox Queue</span>
        </div>

        <div className="field-card p-3.5 space-y-1">
          <span className="text-slate-400 text-[11px]">Last Sync Timestamp</span>
          <div className="font-bold text-slate-200 font-mono text-sm">
            {status.last_synced_at ? status.last_synced_at.replace('T', ' ').slice(0, 19) : 'Offline'}
          </div>
          <span className="text-[10px] text-slate-400">Central PostgreSQL</span>
        </div>

        <div className="field-card p-3.5 space-y-1">
          <span className="text-slate-400 text-[11px]">Conflict Resolution</span>
          <div className="font-bold text-slate-200 font-mono text-sm">LWW / Biologist</div>
          <span className="text-[10px] text-slate-400">Deterministic Audit</span>
        </div>
      </div>

      {/* Outbox Queue Ledger */}
      <div className="field-card p-4 space-y-3 text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-[#233044]">
          <h3 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-emerald-400" />
            <span>Local SQLite Outbox Ledger ({outboxItems.length} Mutations)</span>
          </h3>
          <span className="text-[10px] font-mono text-slate-400">Auto-flushes on reconnection</span>
        </div>

        {outboxItems.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">
            Outbox queue is empty. All local sightings and decisions are synchronized.
          </div>
        ) : (
          <div className="bg-[#0b111e] rounded border border-[#233044] overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#162032] text-slate-400 border-b border-[#233044] text-[10px] uppercase">
                <tr>
                  <th className="p-2.5">Entity Type</th>
                  <th className="p-2.5">Record ID</th>
                  <th className="p-2.5">Action</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Queued Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a2537] text-slate-300">
                {outboxItems.map((item) => (
                  <tr key={item.id} className="hover:bg-[#162236]">
                    <td className="p-2.5 font-semibold text-slate-100">{item.entity_type}</td>
                    <td className="p-2.5 font-mono text-[11px] text-slate-400">{item.entity_id}</td>
                    <td className="p-2.5 font-mono uppercase text-emerald-400 text-[11px]">{item.action}</td>
                    <td className="p-2.5 capitalize">{item.status}</td>
                    <td className="p-2.5 font-mono text-slate-400 text-[11px]">{item.created_at?.slice(0, 19)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
