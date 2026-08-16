import React, { useEffect, useState } from 'react';
import { ApiClient } from '../api/client';
import { TigerSummary, CameraStation, AlertItem } from '../types';
import { ReserveMap } from '../components/map/ReserveMap';
import { 
  FolderUp, Cat, AlertOctagon, Camera, CheckSquare, 
  CloudSun, ArrowUpRight, Trees
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

  return (
    <div className="p-5 space-y-5 max-w-[1500px] mx-auto">
      {/* Top Field Operations Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#0c1a11] p-4 rounded-lg border border-[#1c3525]">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
            <h2 className="text-base font-semibold text-emerald-100 flex items-center gap-2">
              <span>Pench Tiger Reserve — Forest Command & Triage Portal</span>
            </h2>
          </div>
          <p className="text-xs text-emerald-300/70 mt-0.5">
            Phase-IV National Tiger Monitoring Protocol • Turia, Karmajhiri, Jamtara & Gumtara Beats
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onNavigate('ingestion')}
            className="px-3 py-1.5 bg-[#162b1e] hover:bg-[#1f3b2a] text-emerald-200 border border-[#2d523b] text-xs font-semibold rounded transition flex items-center gap-2"
          >
            <FolderUp className="w-4 h-4 text-emerald-400" />
            <span>Ingest SD Card</span>
          </button>
          <button
            onClick={() => onNavigate('review')}
            className="px-3 py-1.5 bg-[#2c1e15] hover:bg-[#3d2c1e] text-amber-200 border border-[#5e3f2b] text-xs font-semibold rounded transition flex items-center gap-2"
          >
            <CheckSquare className="w-4 h-4 text-amber-400" />
            <span>Review Studio (2)</span>
          </button>
        </div>
      </div>

      {/* Structured Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Ingested */}
        <div className="field-card p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-emerald-300/70 font-medium">
            <span>Total Camera Traps</span>
            <Camera className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-100 tabular-nums font-mono">
            {stats?.total_images ?? 128}
          </div>
          <div className="text-[11px] text-emerald-400/80">
            {stats?.triaged_images ?? 98} verified captures
          </div>
        </div>

        {/* Quarantine Vault */}
        <div className="field-card p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-emerald-300/70 font-medium">
            <span>Quarantine Rate</span>
            <span className="text-[10px] text-amber-400 font-mono">Zero Loss</span>
          </div>
          <div className="text-xl font-bold text-amber-300 tabular-nums font-mono">
            {stats?.quarantine_rate_pct ?? '24.2'}%
          </div>
          <div className="text-[11px] text-emerald-400/80">
            {stats?.quarantined_images ?? 30} blank images preserved
          </div>
        </div>

        {/* Identified Tigers */}
        <div 
          onClick={() => onNavigate('catalogue')}
          className="field-card-interactive p-3.5 space-y-1 cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-emerald-300/70 font-medium">
            <span>Identified Tigers</span>
            <Cat className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-400 tabular-nums font-mono">
            {tigers.length || 7} Individuals
          </div>
          <div className="text-[11px] text-emerald-400/80">
            6 Resident • 1 Provisional
          </div>
        </div>

        {/* Active Movement Alerts */}
        <div 
          onClick={() => onNavigate('alerts')}
          className="field-card-interactive p-3.5 space-y-1 cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-emerald-300/70 font-medium">
            <span>Movement Alerts</span>
            <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-bold text-rose-400 tabular-nums font-mono">
            {alerts.length || 2} Active
          </div>
          <div className="text-[11px] text-rose-300/80">
            1 Village Fringe Incursion
          </div>
        </div>

        {/* Survey Effort */}
        <div className="field-card p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-emerald-300/70 font-medium">
            <span>Survey Effort</span>
            <span className="text-[10px] text-emerald-400 font-mono">Active Grid</span>
          </div>
          <div className="text-xl font-bold text-emerald-100 tabular-nums font-mono">
            {totalTrapNights || 1280} <span className="text-xs font-normal text-emerald-400">nights</span>
          </div>
          <div className="text-[11px] text-emerald-400/80">
            Across {stations.length || 16} deployed stations
          </div>
        </div>
      </div>

      {/* Main Split Content: Reserve Map & Operational Alert Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Reserve GIS Map */}
        <div className="lg:col-span-2 field-card p-3.5 flex flex-col h-[520px]">
          <div className="flex items-center justify-between mb-2 px-1">
            <div>
              <h3 className="text-xs font-bold text-emerald-200 uppercase tracking-wide flex items-center gap-1.5">
                <Trees className="w-3.5 h-3.5 text-emerald-400" />
                <span>Pench Reserve Geospatial Monitoring</span>
              </h3>
              <p className="text-[11px] text-emerald-400/70">
                Core Sanctuary Boundaries • Buffer Zones • Station Telemetry • Tiger Centroids
              </p>
            </div>
            <button
              onClick={() => onNavigate('map')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
            >
              <span>Expand Full GIS</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 w-full rounded border border-[#1c3525] overflow-hidden">
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

        {/* Right 1 Col: Actionable Alert Feed & IMD Telemetry */}
        <div className="space-y-4 flex flex-col">
          {/* Priority Alerts Ledger */}
          <div className="field-card p-3.5 flex-1 flex flex-col">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1c3525]">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-rose-400" />
                <h3 className="text-xs font-bold text-emerald-200 uppercase tracking-wide">
                  Active Movement Alerts
                </h3>
              </div>
              <span className="text-[10px] font-mono text-rose-300 bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-800/60">
                {alerts.length} Incidents
              </span>
            </div>

            <div className="space-y-2.5 overflow-y-auto max-h-56 pr-1 text-xs">
              {alerts.map((al) => (
                <div
                  key={al.id}
                  onClick={() => onNavigate('alerts')}
                  className="p-2.5 rounded bg-[#07100a] border border-[#1c3525] hover:border-[#2e553c] transition cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-100">{al.callsign} ({al.tiger_code})</span>
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                      al.severity === 'CRITICAL' ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}>
                      {al.severity}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-200/80 line-clamp-2 leading-relaxed">
                    {al.explanation.what_changed}
                  </p>
                  <div className="text-[10px] text-emerald-400/70 flex items-center justify-between pt-1 border-t border-[#122417]">
                    <span>Effort: {al.explanation.survey_effort}</span>
                    <span className="text-emerald-400 font-mono">{Math.round(al.confidence * 100)}% match</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Meteorological Cache Widget */}
          {weather && (
            <div className="field-card p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between text-emerald-200 font-semibold">
                <div className="flex items-center gap-1.5">
                  <CloudSun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Pench Forest Telemetry</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-[#07100a] px-1.5 py-0.5 rounded border border-[#1c3525]">Turia AWS</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#07100a] p-2 rounded border border-[#1c3525]">
                  <span className="text-emerald-400/70 text-[10px]">Ambient Temp</span>
                  <div className="text-sm font-bold text-emerald-100 mt-0.5 font-mono">{weather.temperature_c}°C</div>
                </div>
                <div className="bg-[#07100a] p-2 rounded border border-[#1c3525]">
                  <span className="text-emerald-400/70 text-[10px]">Relative Humidity</span>
                  <div className="text-sm font-bold text-emerald-100 mt-0.5 font-mono">{weather.humidity_pct}%</div>
                </div>
              </div>
              <div className="bg-[#07100a] p-2 rounded border border-[#1c3525] text-[11px]">
                <span className="text-emerald-400/70">Lunar Canopy Illumination:</span>
                <span className="text-emerald-300 font-medium ml-1.5">{weather.moon_phase}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
