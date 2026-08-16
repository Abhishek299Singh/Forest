import React, { useEffect, useState } from 'react';
import { ApiClient } from '../api/client';
import { TigerSummary, CameraStation, AlertItem } from '../types';
import { ReserveMap } from '../components/map/ReserveMap';
import { 
  FolderUp, Cat, AlertOctagon, Camera, ShieldCheck, 
  CloudSun, Activity, TrendingUp, ArrowUpRight, Zap
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
  const [isLoading, setIsLoading] = useState(true);

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
        console.error('Error fetching dashboard data', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalTrapNights = stations.reduce((acc, s) => acc + (s.active_trap_nights || 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900 to-forest-950/60 p-5 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Pench Tiger Reserve Field Command
            </h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Automated camera trap triage, individual tiger re-identification, and survey-effort normalized movement intelligence.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('ingestion')}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition shadow-lg shadow-emerald-950 flex items-center gap-2"
          >
            <FolderUp className="w-4 h-4" />
            <span>Ingest SD Card</span>
          </button>
          <button
            onClick={() => onNavigate('review')}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl transition border border-slate-700 flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>Human Review Queue</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Captures */}
        <div className="glass-panel p-4 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Captures</span>
            <Camera className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">
            {stats?.total_images ?? 128}
          </div>
          <div className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
            <span>{stats?.triaged_images ?? 98} Triaged Active</span>
          </div>
        </div>

        {/* Quarantined Blanks */}
        <div className="glass-panel p-4 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Quarantine Rate</span>
            <ShieldCheck className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">
            {stats?.quarantine_rate_pct ?? '24.2'}%
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-1">
            <span>{stats?.storage_saved_mb ?? 135} MB storage saved</span>
          </div>
        </div>

        {/* Identified Tigers */}
        <div className="glass-panel p-4 rounded-2xl space-y-2 cursor-pointer hover:border-emerald-500/40 transition" onClick={() => onNavigate('catalogue')}>
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Identified Tigers</span>
            <Cat className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-100">
            {tigers.length || 7} Individuals
          </div>
          <div className="text-xs text-amber-400 flex items-center gap-1 font-medium">
            <span>6 Resident • 1 Provisional</span>
          </div>
        </div>

        {/* Active Alerts */}
        <div className="glass-panel p-4 rounded-2xl space-y-2 cursor-pointer hover:border-rose-500/40 transition" onClick={() => onNavigate('alerts')}>
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Alerts</span>
            <AlertOctagon className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-400">
            {alerts.length || 2} Active
          </div>
          <div className="text-xs text-rose-300/80 flex items-center gap-1">
            <span>1 Critical Village Fringe</span>
          </div>
        </div>

        {/* Survey Effort */}
        <div className="glass-panel p-4 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Survey Effort</span>
            <Activity className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">
            {totalTrapNights || 1280}
          </div>
          <div className="text-xs text-purple-400 font-medium">
            <span>{stations.length || 16} Operational Stations</span>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Map + Side Intelligence Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Interactive Reserve Map */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-4 flex flex-col h-[520px]">
          <div className="flex items-center justify-between mb-3 px-1">
            <div>
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wide">
                Pench Reserve Intelligence Map
              </h3>
              <p className="text-xs text-slate-400">
                Core & Buffer Boundaries • Camera Stations • Tiger Home Ranges • Live Alerts
              </p>
            </div>
            <button
              onClick={() => onNavigate('map')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
            >
              <span>Full Screen GIS</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 w-full rounded-xl overflow-hidden">
            <ReserveMap
              stations={stations}
              tigers={tigers}
              alerts={alerts}
              gisData={gisData}
              onSelectStation={(st) => onNavigate('stations')}
              onSelectTiger={(tid) => onNavigate('catalogue')}
            />
          </div>
        </div>

        {/* Right 1 Col: Live Alert Feed & Local Weather Intelligence */}
        <div className="space-y-4 flex flex-col">
          {/* Active Alerts Panel */}
          <div className="glass-panel p-4 rounded-2xl flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
                <AlertOctagon className="w-4 h-4 text-rose-400" />
                <span>Priority Movement Alerts</span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800">
                {alerts.length} Active
              </span>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-56 pr-1">
              {alerts.map((al) => (
                <div
                  key={al.id}
                  onClick={() => onNavigate('alerts')}
                  className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-rose-500/40 transition cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">{al.callsign} ({al.tiger_code})</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      al.severity === 'CRITICAL' ? 'bg-rose-900/90 text-rose-200' : 'bg-amber-900/90 text-amber-200'
                    }`}>
                      {al.severity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-2">
                    {al.explanation.what_changed}
                  </p>
                  <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-900">
                    <span>Effort: {al.explanation.survey_effort}</span>
                    <span className="text-emerald-400 font-semibold">{intPercent(al.confidence)}% Confidence</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Local Weather & Habitat Telemetry (External Adapter Cache) */}
          {weather && (
            <div className="glass-panel p-4 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300 uppercase tracking-wide">
                <div className="flex items-center gap-1.5">
                  <CloudSun className="w-4 h-4 text-amber-400" />
                  <span>Pench Weather & Telemetry</span>
                </div>
                <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">Cached Offline</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-400">Temperature</span>
                  <div className="text-base font-bold text-slate-200">{weather.temperature_c}°C</div>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-400">Humidity</span>
                  <div className="text-base font-bold text-slate-200">{weather.humidity_pct}%</div>
                </div>
                <div className="col-span-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-400">Moon Phase (Night Camera Trap Impact)</span>
                  <div className="text-xs font-semibold text-emerald-400 mt-0.5">{weather.moon_phase}</div>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {weather.source}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function intPercent(val?: number) {
  if (!val) return 90;
  return Math.round(val * 100);
}
