import React from 'react';
import { useSync } from '../../context/SyncContext';
import { useAuth } from '../../context/AuthContext';
import { Wifi, WifiOff, RefreshCw, AlertCircle, HardDrive, Shield } from 'lucide-react';

export const Header: React.FC = () => {
  const { status, toggleConnectivity, triggerSyncNow } = useSync();
  const { user } = useAuth();

  return (
    <header className="h-14 bg-[#111827] border-b border-[#233044] px-5 flex items-center justify-between sticky top-0 z-40 select-none">
      {/* Reserve Identity & Location Context */}
      <div className="flex items-center gap-3.5">
        <div className="w-8 h-8 rounded bg-[#1e2d24] border border-[#2d4d38] flex items-center justify-center text-emerald-400 font-bold text-sm tracking-wider">
          PTR
        </div>
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-sm font-semibold text-slate-100 tracking-tight">
            Pench Tiger Reserve
          </h1>
          <span className="text-xs text-slate-400">|</span>
          <span className="text-xs text-slate-300 font-medium">
            Camera Trap Triage & Movement Intelligence System
          </span>
          <span className="text-[10px] font-mono text-slate-400 bg-[#162236] px-1.5 py-0.5 rounded border border-[#233044]">
            NTCA Phase-IV
          </span>
        </div>
      </div>

      {/* Sync Status & User Identity */}
      <div className="flex items-center gap-3 text-xs">
        {/* Offline / Online Real Status Pill */}
        <div className="flex items-center gap-2 bg-[#0b111e] px-2.5 py-1 rounded border border-[#233044]">
          <span className={`h-2 w-2 rounded-full ${
            status.sync_status === 'synced' ? 'bg-emerald-500' :
            status.sync_status === 'syncing' ? 'bg-amber-400 animate-pulse' :
            status.sync_status === 'error' ? 'bg-rose-500' :
            'bg-blue-400'
          }`} />

          <span className="text-slate-300 font-medium">
            {status.is_online ? (
              status.sync_status === 'syncing' ? 'Syncing...' : 'Central Server Connected'
            ) : (
              'Offline Field Mode (SQLite)'
            )}
          </span>

          {status.pending_uploads > 0 && (
            <span className="text-amber-400 font-mono font-semibold text-[11px] bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-800/40">
              {status.pending_uploads} in outbox
            </span>
          )}

          {/* Quick Toggle */}
          <button
            onClick={() => toggleConnectivity(!status.is_online)}
            className="ml-1 text-slate-400 hover:text-slate-200 p-0.5 transition"
            title={status.is_online ? 'Disconnect from central server' : 'Connect to central server'}
          >
            {status.is_online ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-slate-400" />}
          </button>

          {status.is_online && (
            <button
              onClick={() => triggerSyncNow()}
              className="text-slate-400 hover:text-emerald-400 p-0.5 transition"
              title="Force sync outbox"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* User Identity */}
        <div className="flex items-center gap-2 pl-3 border-l border-[#233044]">
          <div className="text-right">
            <span className="text-slate-200 font-medium block leading-tight">{user?.full_name?.split('(')[0].trim() || 'Field Officer'}</span>
            <span className="text-[10px] text-emerald-400 font-mono uppercase tracking-wider">{user?.role || 'Forest Staff'}</span>
          </div>
          <div className="w-7 h-7 rounded bg-[#1c2638] border border-[#2d3d57] flex items-center justify-center text-slate-300 font-medium text-xs">
            {user?.full_name?.charAt(0) || 'F'}
          </div>
        </div>
      </div>
    </header>
  );
};
