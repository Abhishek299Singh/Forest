import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api/client';
import { CameraStation } from '../types';
import { Camera, Battery, BatteryCharging, AlertTriangle, CheckCircle2, Shield, MapPin, Search } from 'lucide-react';

export const StationsPage: React.FC = () => {
  const [stations, setStations] = useState<CameraStation[]>([]);
  const [zoneFilter, setZoneFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStations = async () => {
      try {
        const data = await ApiClient.getStations(zoneFilter !== 'all' ? zoneFilter : undefined);
        setStations(data);
      } catch (_) {} finally {
        setIsLoading(false);
      }
    };
    loadStations();
  }, [zoneFilter]);

  const filtered = stations.filter(s => 
    s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.range_beat.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <Camera className="w-6 h-6 text-emerald-400" />
            <span>Camera Station Grid & Survey Effort</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Station deployment status, battery telemetry, active trap-nights effort, and seasonal operational days.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search station..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-emerald-500 w-48"
            />
          </div>

          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Reserve Zones</option>
            <option value="core">Core Zone</option>
            <option value="buffer">Buffer Zone</option>
            <option value="corridor">Corridor Link</option>
          </select>
        </div>
      </div>

      {/* Stations Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800 shadow-xl">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
            <tr>
              <th className="p-3.5">Code & Name</th>
              <th className="p-3.5">Zone & Beat</th>
              <th className="p-3.5">Coordinates</th>
              <th className="p-3.5">Survey Effort</th>
              <th className="p-3.5">Battery</th>
              <th className="p-3.5">Captures</th>
              <th className="p-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850 text-slate-300">
            {filtered.map((st) => {
              const isLowBattery = st.battery_level < 40;
              return (
                <tr key={st.id} className="hover:bg-slate-900/40 transition">
                  <td className="p-3.5">
                    <div className="font-bold text-slate-100">{st.code}</div>
                    <div className="text-slate-400 text-[11px]">{st.name}</div>
                  </td>
                  <td className="p-3.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase inline-block mb-0.5 ${
                      st.zone === 'buffer' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                      st.zone === 'corridor' ? 'bg-purple-950 text-purple-300 border border-purple-800' :
                      'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    }`}>
                      {st.zone}
                    </span>
                    <div className="text-[11px] text-slate-400">{st.range_beat}</div>
                  </td>
                  <td className="p-3.5 font-mono text-[11px] text-slate-400">
                    {st.latitude.toFixed(4)}°N, {st.longitude.toFixed(4)}°E
                  </td>
                  <td className="p-3.5">
                    <div className="font-semibold text-slate-200">{st.active_trap_nights} Trap-nights</div>
                    <div className="text-[10px] text-slate-400">{st.operational_days} active / {st.downtime_days} downtime days</div>
                  </td>
                  <td className="p-3.5">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <Battery className={`w-4 h-4 ${isLowBattery ? 'text-rose-400' : 'text-emerald-400'}`} />
                      <span className={isLowBattery ? 'text-rose-400' : 'text-slate-200'}>{st.battery_level}%</span>
                    </div>
                  </td>
                  <td className="p-3.5 font-semibold text-emerald-400">
                    {st.sightings_count} Tiger Sightings
                  </td>
                  <td className="p-3.5">
                    <span className="flex items-center gap-1.5 text-[11px] text-emerald-300 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                      Active
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
