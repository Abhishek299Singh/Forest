import React from 'react';
import { 
  LayoutDashboard, FolderUp, CheckSquare, Cat, Map, AlertOctagon, 
  Camera, FileSpreadsheet, RefreshCw, SlidersHorizontal
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
  const sections = [
    {
      title: 'Field Operations',
      items: [
        { id: 'dashboard', label: 'Command Overview', icon: LayoutDashboard },
        { id: 'ingestion', label: 'SD Card Ingestion', icon: FolderUp },
        { 
          id: 'review', 
          label: 'Human Review Studio', 
          icon: CheckSquare,
          badge: pendingReviewCount > 0 ? pendingReviewCount : undefined,
          badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
        },
      ]
    },
    {
      title: 'Wildlife Intelligence',
      items: [
        { id: 'catalogue', label: 'Tiger Catalogue', icon: Cat },
        { id: 'map', label: 'Reserve GIS Map', icon: Map },
        { 
          id: 'alerts', 
          label: 'Movement Alerts', 
          icon: AlertOctagon,
          badge: activeAlertCount > 0 ? activeAlertCount : undefined,
          badgeColor: 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
        },
        { id: 'stations', label: 'Camera Trap Grid', icon: Camera },
      ]
    },
    {
      title: 'Compliance & System',
      items: [
        { id: 'reports', label: 'Reports & Export', icon: FileSpreadsheet },
        { id: 'sync', label: 'Synchronization Hub', icon: RefreshCw },
        { id: 'settings', label: 'Threshold Policies', icon: SlidersHorizontal },
      ]
    }
  ];

  return (
    <aside className="w-60 bg-[#0f172a] border-r border-[#233044] flex flex-col h-[calc(100vh-3.5rem)] select-none">
      <div className="p-3 flex-1 space-y-4 overflow-y-auto">
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400 px-2 py-1">
              {section.title}
            </div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition ${
                    isActive
                      ? 'bg-[#1b2b3a] text-emerald-300 border border-emerald-500/30'
                      : 'text-slate-300 hover:text-slate-100 hover:bg-[#162236] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Field System Device Card */}
      <div className="p-3 border-t border-[#233044] bg-[#0b111e]/80 text-[11px] text-slate-400 space-y-1">
        <div className="flex items-center justify-between font-mono text-[10px]">
          <span>Station Unit:</span>
          <span className="text-slate-200">TURIA-HQ-01</span>
        </div>
        <div className="flex items-center justify-between font-mono text-[10px]">
          <span>Storage:</span>
          <span className="text-emerald-400">Local SQLite</span>
        </div>
      </div>
    </aside>
  );
};
