import React from 'react';
import { 
  LayoutDashboard, FolderUp, Cat, CheckSquare, Map, AlertOctagon, 
  Camera, FileSpreadsheet, RefreshCw, Sliders
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  pendingReviewCount?: number;
  activeAlertCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  pendingReviewCount = 2,
  activeAlertCount = 2,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'ingestion', label: 'Image Triage', icon: FolderUp },
    { id: 'catalogue', label: 'Tiger Catalogue', icon: Cat },
    { 
      id: 'review', 
      label: 'Human Review', 
      icon: CheckSquare, 
      badge: pendingReviewCount > 0 ? pendingReviewCount : undefined,
      badgeColor: 'bg-amber-500'
    },
    { id: 'map', label: 'Reserve Map', icon: Map },
    { 
      id: 'alerts', 
      label: 'Movement Alerts', 
      icon: AlertOctagon,
      badge: activeAlertCount > 0 ? activeAlertCount : undefined,
      badgeColor: 'bg-rose-500'
    },
    { id: 'stations', label: 'Camera Stations', icon: Camera },
    { id: 'reports', label: 'Reports & Export', icon: FileSpreadsheet },
    { id: 'sync', label: 'Synchronization', icon: RefreshCw },
    { id: 'settings', label: 'Settings', icon: Sliders },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-[calc(100vh-4rem)] select-none">
      <div className="p-4 flex-1 space-y-1.5 overflow-y-auto">
        <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase px-3 mb-2">
          Wildlife Monitoring
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-950/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Field Mode Indicator Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Device Identity</span>
          <span className="font-mono text-emerald-400 text-[11px]">LAPTOP-01</span>
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
          <span>Offline SQLite Storage Ready</span>
        </div>
      </div>
    </aside>
  );
};
