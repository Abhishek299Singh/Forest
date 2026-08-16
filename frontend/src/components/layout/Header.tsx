import React, { useState, useEffect } from 'react';
import { useSync } from '../../context/SyncContext';
import { useAuth } from '../../context/AuthContext';
import { 
  Wifi, WifiOff, RefreshCw, Trees, Shield, HelpCircle, 
  MapPin, Clock, LogIn, LogOut, UserCheck, Key, ShieldCheck
} from 'lucide-react';

export const Header: React.FC = () => {
  const { status, toggleConnectivity, triggerSyncNow } = useSync();
  const { user, login, logout } = useAuth();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [selectedRange, setSelectedRange] = useState('Turia Core & Buffer');
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('pench123');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setLoginError(null);
    try {
      await login(loginEmail, loginPassword);
      setShowLoginModal(false);
    } catch (err: any) {
      setLoginError(err.message || 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickSwitch = async (email: string) => {
    setIsSubmitting(true);
    setLoginError(null);
    try {
      await login(email, 'pench123');
      setShowUserMenu(false);
    } catch (err: any) {
      alert(`Login failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAdmin = user?.role === 'admin';

  return (
    <>
      <header className="h-12 bg-[#11141a] border-b border-[#232834] px-4 flex items-center justify-between sticky top-0 z-40 select-none text-xs">
        {/* Left: Department & Reserve Identity */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-[#181d26] border border-[#2a3140] flex items-center justify-center text-emerald-400 font-bold">
              <Trees className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-100 text-xs tracking-tight">
                  Pench Tiger Reserve
                </span>
                <span className="text-[10px] font-mono text-slate-400 bg-[#181d26] px-1.5 py-0.2 rounded border border-[#2a3140]">
                  MP Forest Dept
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                NTCA Phase-IV Camera Trap System • Field Terminal
              </div>
            </div>
          </div>

          {/* Range / Beat Selector */}
          <div className="hidden lg:flex items-center gap-1.5 ml-4 pl-4 border-l border-[#232834]">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedRange}
              onChange={(e) => setSelectedRange(e.target.value)}
              className="bg-[#181d26] border border-[#2a3140] text-slate-200 rounded px-2 py-0.5 text-[11px] focus:outline-none focus:border-slate-500 cursor-pointer"
            >
              <option value="Turia Core & Buffer">Turia Range (Core & Buffer)</option>
              <option value="Karmajhiri Sanctuary">Karmajhiri Range (Core)</option>
              <option value="Jamtara Beat">Jamtara Range (Core)</option>
              <option value="Gumtara Buffer">Gumtara Buffer Multi-use</option>
              <option value="Kurai Corridor">Kurai - Kanha Corridor</option>
            </select>
          </div>
        </div>

        {/* Right: Clock, Offline/Online Sync Status, User Profile */}
        <div className="flex items-center gap-3">
          {/* Live System Clock */}
          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-400 font-mono bg-[#181d26] px-2.5 py-0.5 rounded border border-[#2a3140]">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>{currentTime || '16-Aug-2026 • 22:00:00 IST'}</span>
          </div>

          {/* Sync Status Badge */}
          <div className="flex items-center gap-2 bg-[#181d26] px-2 py-0.5 rounded border border-[#2a3140]">
            <span className={`h-2 w-2 rounded-full ${
              status.sync_status === 'synced' ? 'bg-emerald-400' :
              status.sync_status === 'syncing' ? 'bg-amber-400 animate-pulse' :
              status.sync_status === 'error' ? 'bg-rose-500' :
              'bg-slate-500'
            }`} />

            <span className="text-slate-200 font-medium text-[11px]">
              {status.is_online ? (
                status.sync_status === 'syncing' ? 'Reconciling...' : 'Connected (PostGIS)'
              ) : (
                'Field Mode (Local SQLite)'
              )}
            </span>

            {status.pending_uploads > 0 && (
              <span className="text-amber-300 font-mono text-[10px] bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-800/80">
                {status.pending_uploads} in outbox
              </span>
            )}

            {/* Toggle Connectivity */}
            <button
              onClick={() => toggleConnectivity(!status.is_online)}
              className="text-slate-400 hover:text-slate-200 p-0.5 transition ml-1"
              title={status.is_online ? 'Disconnect from central server' : 'Connect to central server'}
            >
              {status.is_online ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-slate-500" />}
            </button>

            {status.is_online && (
              <button
                onClick={() => triggerSyncNow()}
                className="text-slate-400 hover:text-slate-200 p-0.5 transition"
                title="Trigger manual sync"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Help Button */}
          <button
            onClick={() => setShowHelpModal(true)}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-[#232834] rounded transition border border-[#2a3140]"
            title="Field Operator Guide"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          {/* User Profile & Auth Trigger */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 pl-2 border-l border-[#232834] text-left hover:opacity-90 transition"
            >
              <div className="text-right hidden sm:block">
                <span className="text-slate-200 font-medium block leading-tight text-[11px]">
                  {user?.full_name?.split('(')[0].trim() || 'Field User'}
                </span>
                <span className={`text-[9px] font-mono uppercase font-semibold ${
                  isAdmin ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {user?.role || 'RANGER'}
                </span>
              </div>
              <div className={`w-7 h-7 rounded border flex items-center justify-center font-bold text-xs ${
                isAdmin ? 'bg-amber-950 text-amber-300 border-amber-800' : 'bg-[#1b222c] text-emerald-300 border-[#2a3444]'
              }`}>
                {user?.full_name?.charAt(0) || 'U'}
              </div>
            </button>

            {/* User Dropdown */}
            {showUserMenu && (
              <div 
                className="absolute right-0 mt-2 w-64 bg-[#141820] border border-[#2e3544] rounded shadow-2xl p-2.5 space-y-2 z-50 text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="border-b border-[#232834] pb-2">
                  <div className="font-semibold text-slate-100">{user?.full_name}</div>
                  <div className="text-[10px] font-mono text-slate-400">{user?.email}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded font-bold ${
                      isAdmin ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    }`}>
                      Role: {user?.role || 'RANGER'}
                    </span>
                    <span className="text-[9px] font-mono text-slate-500 bg-[#0f1218] px-1 py-0.2 rounded">
                      Firebase Auth
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[9px] font-mono text-slate-500 uppercase">Field Session Role Switch:</div>
                  <button
                    onClick={() => handleQuickSwitch('admin@pench.gov.in')}
                    className={`w-full text-left px-2 py-1 rounded text-[11px] font-mono flex items-center justify-between transition ${
                      user?.email === 'admin@pench.gov.in' ? 'bg-amber-950/80 text-amber-300 border border-amber-800' : 'text-slate-300 hover:bg-[#181d26]'
                    }`}
                  >
                    <span>ADMIN (Director)</span>
                    {user?.email === 'admin@pench.gov.in' && <ShieldCheck className="w-3 h-3 text-amber-400" />}
                  </button>

                  <button
                    onClick={() => handleQuickSwitch('ranger@pench.gov.in')}
                    className={`w-full text-left px-2 py-1 rounded text-[11px] font-mono flex items-center justify-between transition ${
                      user?.email === 'ranger@pench.gov.in' ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800' : 'text-slate-300 hover:bg-[#181d26]'
                    }`}
                  >
                    <span>RANGER (Field Staff)</span>
                    {user?.email === 'ranger@pench.gov.in' && <ShieldCheck className="w-3 h-3 text-emerald-400" />}
                  </button>
                </div>

                <div className="border-t border-[#232834] pt-2 flex items-center justify-between">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      setShowLoginModal(true);
                    }}
                    className="text-[11px] text-slate-300 hover:text-white flex items-center gap-1 font-mono"
                  >
                    <Key className="w-3 h-3 text-slate-400" />
                    <span>Sign In...</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                    }}
                    className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 font-mono"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#141820] border border-[#2e3544] rounded max-w-sm w-full p-4 space-y-3 shadow-2xl text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#232834]">
              <div className="flex items-center gap-1.5 font-semibold text-slate-100">
                <LogIn className="w-4 h-4 text-emerald-400" />
                <span>Field Terminal Authentication</span>
              </div>
              <button
                onClick={() => setShowLoginModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {loginError && (
              <div className="p-2 bg-rose-950 border border-rose-800 rounded text-rose-200 text-[11px]">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-2.5">
              <div>
                <label className="block text-slate-400 text-[10px] uppercase font-mono mb-1">
                  Official Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="admin@pench.gov.in / ranger@pench.gov.in"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-[#181d26] border border-[#2a3140] text-slate-200 rounded px-2.5 py-1.5 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[10px] uppercase font-mono mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-[#181d26] border border-[#2a3140] text-slate-200 rounded px-2.5 py-1.5 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="text-[10px] text-slate-400 font-mono">
                * Verified via Firebase Auth & Pench Local SQLite Role Ledger.
              </div>

              <div className="pt-2 border-t border-[#232834] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLoginModal(false)}
                  className="px-3 py-1.5 bg-[#1e232d] hover:bg-[#282e3c] text-slate-300 rounded border border-[#2e3544]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-medium transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Authenticating...' : 'Sign In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Field Operator Guide Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#141820] border border-[#2e3544] rounded max-w-lg w-full p-4 space-y-3 shadow-xl text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#232834]">
              <div className="flex items-center gap-2 font-semibold text-slate-100 text-xs">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Field Operator Standard Operating Procedures</span>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-slate-300 leading-relaxed text-[11px]">
              <div>
                <span className="font-semibold text-slate-100 block">1. SD Card Ingestion</span>
                Select camera trap directory. Automated triage classifies blanks into the Quarantine Vault with zero data loss, while tigers are forwarded for stripe matching.
              </div>
              <div>
                <span className="font-semibold text-slate-100 block">2. Biologist Stripe Verification</span>
                In the Review Studio, ambiguous stripe matches (50%–85%) are compared side-by-side with reference flanks using contrast filters before assignment.
              </div>
              <div>
                <span className="font-semibold text-slate-100 block">3. Offline-to-Central Reconciliation</span>
                All sightings are saved locally in SQLite while in the field. When arriving at range HQ, connect to upload outbox records to central PostGIS.
              </div>
            </div>

            <div className="pt-2 border-t border-[#232834] flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-3 py-1 bg-[#1e232d] hover:bg-[#282e3c] text-slate-200 rounded border border-[#2e3544] text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
