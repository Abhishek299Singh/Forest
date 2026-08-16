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
    <div className="p-4 space-y-4 max-w-[1600px] mx-auto text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#232834]">
        <div>
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
            <RefreshCw className="w-4 h-4 text-slate-400" />
            <span>Database Synchronization & Local Outbox Ledger</span>
          </h2>
          <p className="text-[11px] text-slate-400">
            Offline SQLite storage, transaction outbox inspection, and cloud reconciliation with Central PostGIS.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleConnectivity(!status.is_online)}
            className={`px-3 py-1 rounded text-xs font-medium border transition flex items-center gap-1.5 ${
              status.is_online
                ? 'bg-[#1a2e20] border-[#26452f] text-emerald-300'
                : 'bg-[#2a2416] border-[#44381e] text-amber-300'
            }`}
          >
            {status.is_online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5 text-slate-500" />}
            <span>{status.is_online ? 'Central Server Online' : 'Field Mode (Offline)'}</span>
          </button>

          {status.is_online && (
            <button
              onClick={() => triggerSyncNow()}
              disabled={isSyncing}
              className="px-3 py-1 bg-[#181d26] hover:bg-[#232834] text-slate-200 text-xs font-medium rounded border border-[#2a3140] transition flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Reconciling...' : 'Sync Outbox Now'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Sync Status Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="field-card p-3 space-y-0.5">
          <span className="text-slate-400 text-[10px]">Field Terminal ID</span>
          <div className="font-semibold text-slate-100 font-mono text-xs">{status.device_id || 'TURIA-HQ-01'}</div>
          <span className="text-[10px] text-slate-400 font-mono">SQLite Local DB</span>
        </div>

        <div className="field-card p-3 space-y-0.5">
          <span className="text-slate-400 text-[10px]">Pending Uploads</span>
          <div className="font-semibold text-amber-400 font-mono text-xs">{status.pending_uploads} records</div>
          <span className="text-[10px] text-slate-400">Local Outbox Queue</span>
        </div>

        <div className="field-card p-3 space-y-0.5">
          <span className="text-slate-400 text-[10px]">Last Sync Timestamp</span>
          <div className="font-semibold text-slate-200 font-mono text-xs">
            {status.last_synced_at ? status.last_synced_at.replace('T', ' ').slice(0, 19) : 'Offline'}
          </div>
          <span className="text-[10px] text-slate-400">Central PostgreSQL</span>
        </div>

        <div className="field-card p-3 space-y-0.5">
          <span className="text-slate-400 text-[10px]">Conflict Protocol</span>
          <div className="font-semibold text-slate-200 font-mono text-xs">Biologist Authority (LWW)</div>
          <span className="text-[10px] text-slate-400">Deterministic Merge</span>
        </div>
      </div>

      {/* Outbox Queue Ledger */}
      <div className="field-card p-3.5 space-y-2.5 text-xs">
        <div className="flex items-center justify-between pb-1.5 border-b border-[#232834]">
          <span className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
            <HardDrive className="w-4 h-4 text-slate-400" />
            <span>Local SQLite Outbox Ledger ({outboxItems.length} Records)</span>
          </span>
          <span className="text-[10px] font-mono text-slate-400">Auto-flushes on reconnection</span>
        </div>

        {outboxItems.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">
            Outbox queue is empty. All local records are fully synchronized with central storage.
          </div>
        ) : (
          <div className="bg-[#11141a] rounded border border-[#232834] overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#181d26] text-slate-400 border-b border-[#232834] text-[10px] uppercase">
                <tr>
                  <th className="p-2">Entity Type</th>
                  <th className="p-2">Record ID</th>
                  <th className="p-2">Action</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Queued Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232834] text-slate-300">
                {outboxItems.map((item) => (
                  <tr key={item.id} className="hover:bg-[#181d26]">
                    <td className="p-2 font-medium text-slate-200">{item.entity_type}</td>
                    <td className="p-2 font-mono text-[11px] text-slate-400">{item.entity_id}</td>
                    <td className="p-2 font-mono uppercase text-slate-300 text-[11px]">{item.action}</td>
                    <td className="p-2 capitalize">{item.status}</td>
                    <td className="p-2 font-mono text-slate-400 text-[11px]">{item.created_at?.slice(0, 19)}</td>
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
