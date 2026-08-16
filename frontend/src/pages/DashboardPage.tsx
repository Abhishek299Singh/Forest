import React, { useEffect, useState } from 'react';
import { ApiClient } from '../api/client';
import { TigerSummary, CameraStation, AlertItem } from '../types';
import { ReserveMap } from '../components/map/ReserveMap';
import { 
  FolderUp, Cat, AlertOctagon, Camera, CheckSquare, 
  ArrowUpRight, Trees, ChevronRight
} from 'lucide-react';

interface DashboardPageProps {
  onNavigate: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<any>(null);
  const [tigers, setTigers] = useState<TigerSummary[]>([]);
  const [stations, setStations] = useState<CameraStation[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [weather, setWeather] = useState<any>(null);
  const [gisData, setGisData] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, tigersRes, stationsRes, alertsRes, weatherRes, gisRes] = await Promise.all([
          ApiClient.getTriageStats(),
          ApiClient.getTigers(),
          ApiClient.getStations(),
          ApiClient.getAlerts({ status: 'active' }),
          ApiClient.getWeather(),
          ApiClient.getGIS(),
        ]);
        setStats(statsRes);
        setTigers(tigersRes);
        setStations(stationsRes);
        setAlerts(alertsRes);
        setWeather(weatherRes?.data);
        setGisData(gisRes?.data);
      } catch (err) {
        console.error('Error loading dashboard data', err);
      }
    };
    fetchData();
  }, []);

  const totalTrapNights = stations.reduce((acc, s) => acc + (s.active_trap_nights || 0), 0);
  const criticalAlert = alerts.find(a => a.severity === 'CRITICAL' && a.status === 'active');

  // Recent Ingestion Batches table data
  const recentBatches = [
    { id: 'BATCH-374799002', station: 'ST-01 (Baghin Nala Crossing)', total: 3, tigers: 2, quarantined: 1, date: '16-Aug-2026 20:30' },
    { id: 'BATCH-374798991', station: 'ST-08 (Gumtara Buffer North)', total: 3, tigers: 3, quarantined: 0, date: '16-Aug-2026 18:45' },
    { id: 'BATCH-374798940', station: 'ST-09 (Telia Lake Fringe)', total: 3, tigers: 1, quarantined: 2, date: '16-Aug-2026 15:10' },
  ];

  return (
    <div className="p-4 space-y-4 max-w-[1600px] mx-auto text-xs">
      {/* 1. Critical Operational Banner (If Active Alert Exists) */}
      {criticalAlert && (
        <div className="bg-[#241212] border border-[#522222] p-3 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 rounded bg-rose-950 text-rose-400 mt-0.5 sm:mt-0">
              <AlertOctagon className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-rose-200">
                  Active Human-Wildlife Interface Incident
                </span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-rose-900 text-rose-200 border border-rose-700">
                  {criticalAlert.tiger_code} • {criticalAlert.callsign}
                </span>
              </div>
              <p className="text-rose-300 text-[11px] mt-0.5 leading-relaxed">
                {criticalAlert.explanation.what_changed} {criticalAlert.explanation.why_it_matters}
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('alerts')}
            className="px-3 py-1 bg-rose-900 hover:bg-rose-800 text-rose-100 font-medium rounded border border-rose-700 transition flex items-center gap-1 shrink-0"
          >
            <span>View Incident Details</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* 2. Operational Key Metrics Strip (Utilitarian Table Format) */}
      <div className="field-card p-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-[#232834] text-center">
          <div className="p-2 space-y-0.5">
            <div className="text-[10px] text-slate-400 font-mono uppercase">Camera Stations</div>
            <div className="text-lg font-semibold text-slate-100 font-mono tabular-nums">{stations.length || 16}</div>
            <div className="text-[10px] text-slate-400">14 Core • 2 Buffer</div>
          </div>

          <div className="p-2 space-y-0.5">
            <div className="text-[10px] text-slate-400 font-mono uppercase">Images Triaged</div>
            <div className="text-lg font-semibold text-slate-100 font-mono tabular-nums">{stats?.total_images ?? 128}</div>
            <div className="text-[10px] text-slate-400">{stats?.triaged_images ?? 98} verified captures</div>
          </div>

          <div className="p-2 space-y-0.5">
            <div className="text-[10px] text-slate-400 font-mono uppercase">Quarantine Vault</div>
            <div className="text-lg font-semibold text-amber-400 font-mono tabular-nums">{stats?.quarantined_images ?? 30}</div>
            <div className="text-[10px] text-slate-400">{stats?.quarantine_rate_pct ?? '24.2'}% zero-loss rate</div>
          </div>

          <div className="p-2 space-y-0.5">
            <div className="text-[10px] text-slate-400 font-mono uppercase">Registered Tigers</div>
            <div className="text-lg font-semibold text-slate-100 font-mono tabular-nums">{tigers.length || 7}</div>
            <div className="text-[10px] text-slate-400">6 Resident • 1 Transient</div>
          </div>

          <div className="p-2 space-y-0.5">
            <div className="text-[10px] text-slate-400 font-mono uppercase">Active Movement Alerts</div>
            <div className="text-lg font-semibold text-rose-400 font-mono tabular-nums">{alerts.length || 2}</div>
            <div className="text-[10px] text-slate-400">1 Village Incursion</div>
          </div>

          <div className="p-2 space-y-0.5">
            <div className="text-[10px] text-slate-400 font-mono uppercase">Survey Effort</div>
            <div className="text-lg font-semibold text-slate-100 font-mono tabular-nums">{totalTrapNights || 1280}</div>
            <div className="text-[10px] text-slate-400">Active Trap-Nights</div>
          </div>
        </div>
      </div>

      {/* 3. Main Split: Operational GIS Map + Active Movement Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 Cols: Reserve GIS Map */}
        <div className="lg:col-span-2 field-card p-3 flex flex-col h-[520px]">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#232834]">
            <div>
              <span className="font-semibold text-slate-200 text-xs">
                Pench Reserve Camera Trap Grid & Spatial Occupancy
              </span>
              <span className="text-[10px] text-slate-400 ml-2">
                (Turia & Karmajhiri Ranges • 16 Trap Stations)
              </span>
            </div>
            <button
              onClick={() => onNavigate('map')}
              className="text-[11px] text-slate-300 hover:text-white flex items-center gap-1 font-medium"
            >
              <span>Expand Map Controls</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 w-full rounded border border-[#232834] overflow-hidden">
            <ReserveMap
              stations={stations}
              tigers={tigers}
              alerts={alerts}
              gisData={gisData}
              onSelectStation={() => onNavigate('stations')}
              onSelectTiger={() => onNavigate('catalogue')}
            />
          </div>
        </div>

        {/* Right 1 Col: Incident Queue & Quick Actions */}
        <div className="field-card p-3 flex flex-col h-[520px]">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#232834]">
            <span className="font-semibold text-slate-200 text-xs">
              Active Alerts & Deviations ({alerts.length})
            </span>
            <button
              onClick={() => onNavigate('alerts')}
              className="text-[11px] text-slate-400 hover:text-white"
            >
              View All
            </button>
          </div>

          <div className="space-y-2 overflow-y-auto flex-1 pr-1">
            {alerts.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                No active movement alerts recorded.
              </div>
            ) : (
              alerts.map((al) => {
                const isCrit = al.severity === 'CRITICAL';
                return (
                  <div
                    key={al.id}
                    className="p-2.5 rounded bg-[#181d26] border border-[#232834] space-y-1 hover:border-[#313848] transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200 text-xs">{al.callsign}</span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-medium ${
                        isCrit ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}>
                        {al.severity} • {al.alert_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      {al.explanation.what_changed}
                    </p>
                    <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-[#232834] font-mono">
                      <span>{al.explanation.location}</span>
                      <span>{al.created_at.split('T')[0]}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Actions Footer */}
          <div className="pt-2.5 mt-2 border-t border-[#232834] flex gap-2">
            <button
              onClick={() => onNavigate('ingestion')}
              className="flex-1 px-2.5 py-1.5 bg-[#181d26] hover:bg-[#232834] text-slate-200 rounded border border-[#2a3140] text-[11px] font-medium flex items-center justify-center gap-1.5"
            >
              <FolderUp className="w-3.5 h-3.5 text-slate-400" />
              <span>Ingest SD Card</span>
            </button>
            <button
              onClick={() => onNavigate('review')}
              className="flex-1 px-2.5 py-1.5 bg-[#181d26] hover:bg-[#232834] text-slate-200 rounded border border-[#2a3140] text-[11px] font-medium flex items-center justify-center gap-1.5"
            >
              <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
              <span>Review Studio (2)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Recent SD Card Triage Runs (Data Table) */}
      <div className="field-card p-3 space-y-2">
        <div className="flex items-center justify-between pb-1 border-b border-[#232834]">
          <span className="font-semibold text-slate-200 text-xs">
            Recent SD Card Intake Runs
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            Showing last 3 batches
          </span>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="bg-[#181d26] text-slate-400 text-[11px]">
            <tr>
              <th className="p-2 font-medium">Batch ID</th>
              <th className="p-2 font-medium">Station Source</th>
              <th className="p-2 font-medium">Total Images</th>
              <th className="p-2 font-medium">Tigers Detected</th>
              <th className="p-2 font-medium">Quarantined Blanks</th>
              <th className="p-2 font-medium">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#232834] text-slate-300">
            {recentBatches.map((b) => (
              <tr key={b.id} className="hover:bg-[#181d26]/50">
                <td className="p-2 font-mono text-slate-200">{b.id}</td>
                <td className="p-2">{b.station}</td>
                <td className="p-2 font-mono tabular-nums">{b.total}</td>
                <td className="p-2 font-mono tabular-nums text-emerald-400">{b.tigers}</td>
                <td className="p-2 font-mono tabular-nums text-amber-400">{b.quarantined}</td>
                <td className="p-2 font-mono text-[11px] text-slate-400">{b.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
