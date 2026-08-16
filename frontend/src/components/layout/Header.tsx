import React, { useState, useEffect } from 'react';
import { useSync } from '../../context/SyncContext';
import { useAuth } from '../../context/AuthContext';
import { 
  Wifi, WifiOff, RefreshCw, Trees, Shield, Bell, HelpCircle, 
  ChevronDown, MapPin, Clock, HardDrive
} from 'lucide-react';

export const Header: React.FC = () => {
  const { status, toggleConnectivity, triggerSyncNow } = useSync();
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [selectedRange, setSelectedRange] = useState('Turia Core & Buffer');
  const [showHelpModal, setShowHelpModal] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
        ' • ' +
        now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) +
        ' IST'
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <header className="h-14 bg-[#0a160e] border-b border-[#1b3623] px-4 flex items-center justify-between sticky top-0 z-40 select-none text-xs">
        {/* Left: Official Emblem & Reserve Brand */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-[#13271a] border border-[#274f33] flex items-center justify-center text-emerald-400 font-bold shadow-sm">
              <Trees className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-100 text-sm tracking-tight">
                  Pench Tiger Reserve
                </span>
                <span className="text-[10px] font-mono text-emerald-400 bg-[#13271a] px-1.5 py-0.2 rounded border border-[#274f33]">
                  MP Forest Dept
                </span>
              </div>
              <div className="text-[10px] text-emerald-400/80 flex items-center gap-1 font-mono">
                <span>Phase-IV Wildlife Intelligence</span>
                <span>•</span>
                <span>ID: PTR-FIELD-01</span>
              </div>
            </div>
          </div>

          {/* Range Selector Dropdown */}
          <div className="hidden lg:flex items-center gap-1.5 ml-4 pl-4 border-l border-[#1b3623]">
            <MapPin className="w-3.5 h-3.5 text-emerald-500" />
            <select
              value={selectedRange}
              onChange={(e) => setSelectedRange(e.target.value)}
              className="bg-[#0e1f14] border border-[#1b3623] text-emerald-200 rounded px-2 py-1 text-[11px] focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="Turia Core & Buffer">Turia Range (Core & Buffer)</option>
              <option value="Karmajhiri Sanctuary">Karmajhiri Range (Core)</option>
              <option value="Jamtara Beat">Jamtara Range (Core)</option>
              <option value="Gumtara Buffer">Gumtara Buffer Multi-use</option>
              <option value="Kurai Corridor">Kurai - Kanha Corridor</option>
            </select>
          </div>
        </div>

        {/* Right: Live Clock, Sync Status, Help, Profile */}
        <div className="flex items-center gap-3">
          {/* Live System Clock */}
          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-emerald-300/80 font-mono bg-[#0e1f14] px-2.5 py-1 rounded border border-[#1b3623]">
            <Clock className="w-3 h-3 text-emerald-500" />
            <span>{currentTime || '16-Aug-2026 • 21:40:00 IST'}</span>
          </div>

          {/* Sync Status Badge */}
          <div className="flex items-center gap-2 bg-[#0e1f14] px-2.5 py-1 rounded border border-[#1b3623]">
            <span className={`h-2 w-2 rounded-full ${
              status.sync_status === 'synced' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]' :
              status.sync_status === 'syncing' ? 'bg-amber-400 animate-pulse' :
              status.sync_status === 'error' ? 'bg-rose-500' :
              'bg-emerald-400'
            }`} />

            <span className="text-emerald-100 font-medium text-[11px]">
              {status.is_online ? (
                status.sync_status === 'syncing' ? 'Syncing...' : 'Central Server Online'
              ) : (
                'Offline Field Mode (SQLite)'
              )}
            </span>

            {status.pending_uploads > 0 && (
              <span className="text-amber-300 font-mono font-semibold text-[10px] bg-amber-950/90 px-1.5 py-0.2 rounded border border-amber-800/80">
                {status.pending_uploads} outbox
              </span>
            )}

            {/* Toggle Connectivity */}
            <button
              onClick={() => toggleConnectivity(!status.is_online)}
              className="text-emerald-400 hover:text-emerald-200 p-0.5 transition ml-1"
              title={status.is_online ? 'Disconnect from central server' : 'Connect to central server'}
            >
              {status.is_online ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-emerald-600" />}
            </button>

            {status.is_online && (
              <button
                onClick={() => triggerSyncNow()}
                className="text-emerald-400 hover:text-emerald-200 p-0.5 transition"
                title="Trigger immediate sync"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Help Button */}
          <button
            onClick={() => setShowHelpModal(true)}
            className="p-1.5 text-emerald-400 hover:text-emerald-200 hover:bg-[#13271a] rounded transition border border-[#1b3623]"
            title="Field Manual & Keyboard Shortcuts"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          {/* User Profile Chip */}
          <div className="flex items-center gap-2 pl-2 border-l border-[#1b3623]">
            <div className="text-right hidden sm:block">
              <span className="text-slate-100 font-medium block leading-tight text-[11px]">
                {user?.full_name?.split('(')[0].trim() || 'Dr. Vivek Kamble'}
              </span>
              <span className="text-[9px] text-emerald-400 font-mono uppercase tracking-wider">
                {user?.role ? user.role.replace('_', ' ') : 'Field Biologist'}
              </span>
            </div>
            <div className="w-7 h-7 rounded bg-[#13271a] border border-[#274f33] flex items-center justify-center text-emerald-300 font-bold text-xs">
              {user?.full_name?.charAt(0) || 'V'}
            </div>
          </div>
        </div>
      </header>

      {/* Field Manual / Keyboard Shortcuts Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#0e1f14] border border-[#23452c] rounded-lg max-w-lg w-full p-5 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#1b3623]">
              <div className="flex items-center gap-2 font-bold text-slate-100 text-sm">
                <HelpCircle className="w-4 h-4 text-emerald-400" />
                <span>Field Operator Quick Guide & Shortcuts</span>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-emerald-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-emerald-200/90 leading-relaxed">
              <div>
                <h4 className="font-semibold text-emerald-300">1. SD Card Ingestion Workflow</h4>
                <p className="text-[11px] text-emerald-400/80 mt-0.5">
                  Insert memory card from Cuddeback/Reconyx camera, select the folder in the <strong>SD Card Ingestion</strong> tab, and click <em>Run Forest Triage</em>. Blanks are safely quarantined with zero loss.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-emerald-300">2. Biologist Stripe Verification</h4>
                <p className="text-[11px] text-emerald-400/80 mt-0.5">
                  In <strong>Human Review Studio</strong>, compare the captured lateral flank against reference profiles. Use contrast filters (*Grayscale, Invert Contrast*) to inspect stripe bifurcations.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-emerald-300">3. Offline-to-Online Sync</h4>
                <p className="text-[11px] text-emerald-400/80 mt-0.5">
                  All sightings and reviews are saved locally in SQLite while in the deep forest. When returning to Turia Range HQ, click the WiFi icon to upload outbox records to the Central PostGIS server.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-[#1b3623] flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-1.5 bg-[#162b1e] hover:bg-[#1f3b2a] text-emerald-200 rounded border border-[#2d523b] font-medium"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
