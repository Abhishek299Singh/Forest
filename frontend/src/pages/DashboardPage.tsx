import React, { useEffect, useState } from 'react';
import { ApiClient } from '../api/client';
import { TigerSummary, CameraStation, AlertItem } from '../types';
import { ReserveMap } from '../components/map/ReserveMap';
import { 
  FolderUp, Cat, AlertOctagon, Camera, CheckSquare, 
  CloudSun, ArrowUpRight, Trees, Clock, ShieldAlert,
  ChevronRight, RefreshCw, CheckCircle2
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
  const [filterActivity, setFilterActivity] = useState<'all' | 'tigers' | 'alerts' | 'triage'>('all');

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

  // Simulated authentic field activity log
  const activityLogs = [
    {
      id: 'act-1',
      type: 'alerts',
      title: 'Village Fringe Alert: PTR-T-021 (Telia Male)',
      time: '12 mins ago',
      desc: 'Captured at ST-09 (Telia Lake Fringe). 1.1 km from Telia village boundary.',
      tag: 'Critical',
      tagColor: 'bg-rose-950 text-rose-300 border border-rose-800'
    },
    {
      id: 'act-2',
      type: 'tigers',
      title: 'Tiger Sighting: PTR-T-014 (Baghin Nala Female)',
      time: '45 mins ago',
      desc: 'Camera ST-08 (Gumtara Buffer North) recorded bilateral flank capture. Confirmed with 94% stripe match.',
      tag: 'Core Resident',
      tagColor: 'bg-emerald-950 text-emerald-300 border border-emerald-800'
    },
    {
      id: 'act-3',
      type: 'triage',
      title: 'SD Card Ingestion: BATCH-374799002 Completed',
      time: '1 hour ago',
      desc: '3 images processed. 1 blank foliage photo moved to Quarantine Vault (4.5 MB saved).',
      tag: 'Triage Run',
      tagColor: 'bg-[#162b1e] text-emerald-300 border border-[#2d523b]'
    },
    {
      id: 'act-4',
      type: 'tigers',
      title: 'Tiger Sighting: PTR-T-032 (Collarwali Lineage Male)',
      time: '2 hours ago',
      desc: 'Captured at ST-01 (Baghin Nala Crossing). Sighting within expected core territory.',
      tag: 'Core Resident',
      tagColor: 'bg-emerald-950 text-emerald-300 border border-emerald-800'
    }
  ];

  const filteredLogs = activityLogs.filter(a => filterActivity === 'all' || a.type === filterActivity);

  return (
    <div className="p-4 md:p-5 space-y-4 max-w-[1600px] mx-auto text-xs">
      {/* 1. Critical Operational Banner (If Active Alert Exists) */}
      {criticalAlert && (
        <div className="bg-[#241010] border border-[#5c1d1d] p-3.5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-md">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded bg-rose-950/80 border border-rose-800 text-rose-300 mt-0.5 sm:mt-0">
              <AlertOctagon className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-rose-200 text-sm">
                  Active Human-Wildlife Interface Incident
                </span>
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-900 text-rose-200 border border-rose-700">
                  {criticalAlert.tiger_code} • {criticalAlert.callsign}
                </span>
              </div>
              <p className="text-rose-300/90 text-[11px] mt-0.5 leading-relaxed">
                {criticalAlert.explanation.what_changed} {criticalAlert.explanation.why_it_matters}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onNavigate('alerts')}
              className="px-3 py-1.5 bg-rose-900 hover:bg-rose-800 text-rose-100 font-semibold rounded border border-rose-700 transition flex items-center gap-1.5"
            >
              <span>Review Patrol Protocol</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Top Action Bar & Reserve Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#0c1a11] p-3.5 rounded-lg border border-[#1c3525]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#162b1e] border border-[#2d523b] flex items-center justify-center text-emerald-400 font-bold">
            <Trees className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-slate-100 text-sm">
              Turia & Karmajhiri Daily Wildlife Intelligence Overview
            </div>
            <div className="text-[11px] text-emerald-400/80">
              Active Grid: 16 Trap Stations • 7 Identified Individuals • Zero Image Loss Policy
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('ingestion')}
            className="px-3 py-1.5 bg-[#162b1e] hover:bg-[#1f3b2a] text-emerald-200 border border-[#2d523b] text-xs font-semibold rounded transition flex items-center gap-1.5"
          >
            <FolderUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ingest SD Card</span>
          </button>
          <button
            onClick={() => onNavigate('review')}
            className="px-3 py-1.5 bg-[#2c1e15] hover:bg-[#3d2c1e] text-amber-200 border border-[#5e3f2b] text-xs font-semibold rounded transition flex items-center gap-1.5"
          >
            <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
            <span>Review Studio (2)</span>
          </button>
        </div>
      </div>

      {/* 3. High-Density Operational KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Images */}
        <div className="field-card p-3 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-emerald-400/80 font-medium">
            <span>Camera Trap Photos</span>
            <Camera className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-slate-100 tabular-nums font-mono">
            {stats?.total_images ?? 128}
          </div>
          <div className="text-[10px] text-emerald-400/70">
            {stats?.triaged_images ?? 98} verified captures
          </div>
        </div>

        {/* Quarantined Blanks */}
        <div 
          onClick={() => onNavigate('ingestion')}
          className="field-card-interactive p-3 space-y-1 cursor-pointer"
        >
          <div className="flex items-center justify-between text-[11px] text-emerald-400/80 font-medium">
            <span>Quarantine Vault</span>
            <span className="text-[9px] text-amber-300 font-mono">Zero Loss</span>
          </div>
          <div className="text-xl font-bold text-amber-300 tabular-nums font-mono">
            {stats?.quarantined_images ?? 30} <span className="text-xs font-normal text-emerald-400/70">({stats?.quarantine_rate_pct ?? '24.2'}%)</span>
          </div>
          <div className="text-[10px] text-emerald-400/70">
            Foliage & blanks preserved
          </div>
        </div>

        {/* Identified Tigers */}
        <div 
          onClick={() => onNavigate('catalogue')}
          className="field-card-interactive p-3 space-y-1 cursor-pointer"
        >
          <div className="flex items-center justify-between text-[11px] text-emerald-400/80 font-medium">
            <span>Identified Tigers</span>
            <Cat className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-400 tabular-nums font-mono">
            {tigers.length || 7} Individuals
          </div>
          <div className="text-[10px] text-emerald-400/70">
            6 Resident • 1 Provisional
          </div>
        </div>

        {/* Movement Alerts */}
        <div 
          onClick={() => onNavigate('alerts')}
          className="field-card-interactive p-3 space-y-1 cursor-pointer"
        >
          <div className="flex items-center justify-between text-[11px] text-emerald-400/80 font-medium">
            <span>Movement Alerts</span>
            <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-bold text-rose-400 tabular-nums font-mono">
            {alerts.length || 2} Active
          </div>
          <div className="text-[10px] text-rose-300/80">
            1 Village Incursion Alert
          </div>
        </div>

        {/* Survey Effort */}
        <div className="field-card p-3 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-emerald-400/80 font-medium">
            <span>Survey Effort</span>
            <span className="text-[9px] text-emerald-400 font-mono">Active Matrix</span>
          </div>
          <div className="text-xl font-bold text-slate-100 tabular-nums font-mono">
            {totalTrapNights || 1280} <span className="text-xs font-normal text-emerald-400/70">nights</span>
          </div>
          <div className="text-[10px] text-emerald-400/70">
            Across {stations.length || 16} active stations
          </div>
        </div>
      </div>

      {/* 4. Main Split: GIS Map + Live Incident & Telemetry Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 Cols: Reserve GIS Map */}
        <div className="lg:col-span-2 field-card p-3 flex flex-col h-[500px]">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-emerald-200 text-xs uppercase tracking-wider">
                Geospatial Camera Grid & Tiger Movement
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-[#07100a] px-1.5 py-0.2 rounded border border-[#1c3525]">
                MapLibre GL
              </span>
            </div>
            <button
              onClick={() => onNavigate('map')}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
            >
              <span>Full Spatial Map</span>
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

        {/* Right 1 Col: Live Activity Stream */}
        <div className="field-card p-3 flex flex-col h-[500px]">
          {/* Header & Filter Buttons */}
          <div className="pb-2 mb-2 border-b border-[#1c3525]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-emerald-200 text-xs uppercase tracking-wider">
                Reserve Telemetry & Activity Feed
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-[#07100a] px-1.5 py-0.2 rounded border border-[#1c3525]">
                Real-time
              </span>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1 text-[10px]">
              {(['all', 'tigers', 'alerts', 'triage'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterActivity(f)}
                  className={`px-2 py-0.5 rounded capitalize font-medium transition ${
                    filterActivity === f
                      ? 'bg-[#162b1e] text-emerald-200 border border-[#2d523b]'
                      : 'text-emerald-500 hover:text-emerald-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Activity List */}
          <div className="space-y-2 overflow-y-auto flex-1 pr-1">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-2.5 rounded bg-[#07100a] border border-[#1c3525] space-y-1 hover:border-[#2e553c] transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-100 text-[11px]">{log.title}</span>
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${log.tagColor}`}>
                    {log.tag}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-200/80 leading-relaxed">
                  {log.desc}
                </p>
                <div className="text-[9px] text-emerald-500 font-mono pt-1 border-t border-[#122417]">
                  {log.time}
                </div>
              </div>
            ))}
          </div>

          {/* Weather footer */}
          {weather && (
            <div className="pt-2 mt-2 border-t border-[#1c3525] flex items-center justify-between text-[11px] text-emerald-300">
              <div className="flex items-center gap-1.5">
                <CloudSun className="w-3.5 h-3.5 text-amber-400" />
                <span>Pench AWS: <strong>{weather.temperature_c}°C</strong></span>
              </div>
              <span className="text-emerald-500 text-[10px]">Humidity: {weather.humidity_pct}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
