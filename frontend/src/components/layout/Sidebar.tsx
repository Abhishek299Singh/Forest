import React from 'react';
import { 
  LayoutDashboard, FolderUp, CheckSquare, Cat, Map, AlertOctagon, 
  Camera, FileSpreadsheet, RefreshCw, SlidersHorizontal, Users, ShieldAlert
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  pendingReviewCount?: number;
  activeAlertCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  pendingReviewCount = 0,
  activeAlertCount = 0,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const sections = [
    {
      title: 'OPERATIONS',
      items: [
        { id: 'dashboard', label: 'Command Overview', icon: LayoutDashboard },
        { id: 'ingestion', label: 'SD Card Ingestion', icon: FolderUp },
        { 
          id: 'review', 
          label: 'Biologist Review Studio', 
          icon: CheckSquare,
          badge: pendingReviewCount > 0 ? pendingReviewCount : undefined,
          badgeColor: 'bg-amber-950 text-amber-300 border border-amber-800'
        },
      ]
    },
    {
      title: isAdmin ? 'MONITORING & GIS' : 'FIELD MONITORING',
      items: [
        { id: 'catalogue', label: 'Tiger Catalogue', icon: Cat },
        { id: 'map', label: 'Reserve GIS Map', icon: Map },
        { 
          id: 'alerts', 
          label: 'Movement Alerts', 
          icon: AlertOctagon,
          badge: activeAlertCount > 0 ? activeAlertCount : undefined,
          badgeColor: 'bg-rose-950 text-rose-300 border border-rose-800'
        },
        { id: 'stations', label: 'Camera Trap Grid', icon: Camera },
      ]
    },
    ...(isAdmin ? [
      {
        title: 'ADMINISTRATION',
        items: [
          { id: 'users', label: 'User Management (RBAC)', icon: Users },
          { id: 'reports', label: 'Reports & Export', icon: FileSpreadsheet },
          { id: 'sync', label: 'Database Synchronization', icon: RefreshCw },
          { id: 'settings', label: 'Threshold Policies', icon: SlidersHorizontal },
        ]
      }
    ] : [])
  ];

  return (
    <aside className="w-56 bg-[#11141a] border-r border-[#232834] flex flex-col h-[calc(100vh-3rem)] select-none shrink-0 text-xs">
      <div className="p-2.5 flex-1 space-y-4 overflow-y-auto">
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-0.5">
            <div className="text-[10px] font-mono font-medium text-slate-400 px-2 py-1 tracking-wider">
              {section.title}
            </div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs font-normal transition text-left ${
                    isActive
                      ? 'bg-[#1c222c] text-white border-l-2 border-l-emerald-500 border-t-0 border-r-0 border-b-0 pl-2 font-medium'
                      : 'text-slate-300 hover:text-white hover:bg-[#161a22]'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded shrink-0 ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Field System Device Card & Authenticated Role */}
      <div className="p-2.5 border-t border-[#232834] bg-[#0d1015] text-[10px] text-slate-400 space-y-1 font-mono">
        <div className="flex items-center justify-between">
          <span>Role Auth:</span>
          <span className={`font-semibold px-1 rounded uppercase ${
            isAdmin ? 'text-amber-300 bg-amber-950/80 border border-amber-800' : 'text-emerald-300 bg-emerald-950/80 border border-emerald-800'
          }`}>
            {user?.role || 'RANGER'}
          </span>
        </div>
        <div className="flex items-center justify-between text-slate-500 text-[9px]">
          <span>Terminal:</span>
          <span className="text-slate-400">PTR-TURIA-01</span>
        </div>
      </div>
    </aside>
  );
};
