import React from 'react';
import { useSync } from '../../context/SyncContext';
import { useAuth } from '../../context/AuthContext';
import { useWebSocket } from '../../context/WebSocketContext';
import { 
  Wifi, WifiOff, RefreshCw, AlertTriangle, Shield, HardDrive, 
  Radio, CheckCircle2, User as UserIcon
} from 'lucide-react';

export const Header: React.FC = () => {
  const { status, toggleConnectivity, triggerSyncNow } = useSync();
  const { user } = useAuth();
  const { isConnected } = useWebSocket();

  const getSyncBadge = () => {
    switch (status.sync_status) {
      case 'synced':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Online — Synced</span>
          </div>
        );
      case 'syncing':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300 text-xs font-medium">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
            <span>Online — Syncing...</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs font-medium">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>Sync Error ({status.failed_count})</span>
          </div>
        );
      case 'offline':
      default:
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-950/80 border border-blue-500/40 text-blue-300 text-xs font-medium">
            <HardDrive className="w-3.5 h-3.5 text-blue-400" />
            <span>Offline — Working Locally</span>
          </div>
        );
    }
  };

  return (
    <header className="h-16 bg-slate-900/90 border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md">
      {/* Title & Reserve Identity */}
      <div className="flex items-center gap-4">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-600 to-forest-900 flex items-center justify-center shadow-lg shadow-emerald-950/50 border border-emerald-500/30">
          <Shield className="w-5 h-5 text-emerald-200" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-slate-100 tracking-tight">
              Pench Tiger Reserve
            </h1>
            <span className="text-[11px] font-medium tracking-wide uppercase px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700">
              Field Intelligence v2.4
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Automated Camera Trap Triage & Tiger Movement Platform
          </p>
        </div>
      </div>

      {/* Center / Right Sync & Controls */}
      <div className="flex items-center gap-4">
        {/* Real-time sync status indicator */}
        <div className="flex items-center gap-3 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800">
          {getSyncBadge()}

          {status.pending_uploads > 0 && (
            <span className="text-xs text-slate-300 px-2 py-1 bg-slate-800/90 rounded-lg border border-slate-700">
              <span className="font-semibold text-amber-400">{status.pending_uploads}</span> Pending Uploads
            </span>
          )}

          {/* Quick toggle offline/online button */}
          <button
            onClick={() => toggleConnectivity(!status.is_online)}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
              status.is_online
                ? 'bg-emerald-900/40 text-emerald-300 hover:bg-emerald-800/50 border border-emerald-700/50'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
            }`}
            title="Toggle connection to central server"
          >
            {status.is_online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {status.is_online ? 'Connected' : 'Go Online'}
          </button>

          {status.is_online && (
            <button
              onClick={() => triggerSyncNow()}
              className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition"
              title="Sync now"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* User Role Badge */}
        <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
          <div className="text-right">
            <div className="text-xs font-medium text-slate-200">{user?.full_name || 'Field Officer'}</div>
            <div className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold">
              {user?.role || 'Forest Staff'}
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
            <UserIcon className="w-4 h-4" />
          </div>
        </div>
      </div>
    </header>
  );
};
