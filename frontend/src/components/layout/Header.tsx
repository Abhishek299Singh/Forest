import React from 'react';
import { useSync } from '../../context/SyncContext';
import { useAuth } from '../../context/AuthContext';
import { Wifi, WifiOff, RefreshCw, Trees, Shield } from 'lucide-react';

export const Header: React.FC = () => {
  const { status, toggleConnectivity, triggerSyncNow } = useSync();
  const { user } = useAuth();

  return (
    <header className="h-14 bg-[#0c1a11] border-b border-[#1c3525] px-5 flex items-center justify-between sticky top-0 z-40 select-none">
      {/* Reserve Identity & Location Context */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-[#162b1e] border border-[#2d523b] flex items-center justify-center text-emerald-400 font-bold text-sm shadow-inner">
          <Trees className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-sm font-semibold text-emerald-100 tracking-tight flex items-center gap-1.5">
            <span>Pench Tiger Reserve</span>
          </h1>
          <span className="text-xs text-emerald-700">|</span>
          <span className="text-xs text-emerald-300 font-medium">
            Forest Intelligence & Camera Trap Triage
          </span>
          <span className="text-[10px] font-mono text-emerald-300 bg-[#122417] px-1.5 py-0.5 rounded border border-[#23412e]">
            NTCA Phase-IV
          </span>
        </div>
      </div>

      {/* Sync Status & User Identity */}
      <div className="flex items-center gap-3 text-xs">
        {/* Offline / Online Forest Status Pill */}
        <div className="flex items-center gap-2 bg-[#07100a] px-2.5 py-1 rounded border border-[#1c3525]">
          <span className={`h-2 w-2 rounded-full ${
            status.sync_status === 'synced' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
            status.sync_status === 'syncing' ? 'bg-amber-400 animate-pulse' :
            status.sync_status === 'error' ? 'bg-rose-500' :
            'bg-emerald-400'
          }`} />

          <span className="text-emerald-200 font-medium">
            {status.is_online ? (
              status.sync_status === 'syncing' ? 'Syncing with HQ...' : 'Reserve Server Linked'
            ) : (
              'Field Offline (Local SQLite)'
            )}
          </span>

          {status.pending_uploads > 0 && (
            <span className="text-amber-300 font-mono font-semibold text-[11px] bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-800/60">
              {status.pending_uploads} in outbox
            </span>
          )}

          {/* Quick Toggle */}
          <button
            onClick={() => toggleConnectivity(!status.is_online)}
            className="ml-1 text-emerald-400 hover:text-emerald-200 p-0.5 transition"
            title={status.is_online ? 'Disconnect from central server' : 'Connect to central server'}
          >
            {status.is_online ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-emerald-700" />}
          </button>

          {status.is_online && (
            <button
              onClick={() => triggerSyncNow()}
              className="text-emerald-400 hover:text-emerald-200 p-0.5 transition"
              title="Force sync outbox"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* User Identity */}
        <div className="flex items-center gap-2 pl-3 border-l border-[#1c3525]">
          <div className="text-right">
            <span className="text-emerald-100 font-medium block leading-tight">{user?.full_name?.split('(')[0].trim() || 'Field Officer'}</span>
            <span className="text-[10px] text-emerald-400 font-mono uppercase tracking-wider">{user?.role || 'Forest Staff'}</span>
          </div>
          <div className="w-7 h-7 rounded bg-[#162b1e] border border-[#2d523b] flex items-center justify-center text-emerald-300 font-medium text-xs">
            {user?.full_name?.charAt(0) || 'F'}
          </div>
        </div>
      </div>
    </header>
  );
};
