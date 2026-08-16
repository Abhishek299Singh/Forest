import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api/client';
import { CameraStation } from '../types';
import { Camera, Search } from 'lucide-react';

export const StationsPage: React.FC = () => {
  const [stations, setStations] = useState<CameraStation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [zoneFilter, setZoneFilter] = useState<string>('all');

  useEffect(() => {
    const loadStations = async () => {
      try {
        const data = await ApiClient.getStations(zoneFilter !== 'all' ? zoneFilter : undefined);
        setStations(data);
      } catch (_) {}
    };
    loadStations();
  }, [zoneFilter]);

  const filtered = stations.filter(s =>
    s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.range_beat.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-5 space-y-5 max-w-[1500px] mx-auto">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#233044]">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Camera className="w-5 h-5 text-emerald-400" />
            <span>Camera Trap Grid & Survey Effort Matrix</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Operational status, active trap-night logs, battery telemetry, and cumulative tiger captures per deployed station.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search station or beat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#0b111e] border border-[#233044] text-slate-100 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:border-emerald-500 w-52 font-sans"
            />
          </div>

          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="bg-[#0b111e] border border-[#233044] text-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Zones</option>
            <option value="core">Core Sanctuary</option>
            <option value="buffer">Buffer Zone</option>
            <option value="corridor">Corridor Link</option>
          </select>
        </div>
      </div>

      {/* Structured Table */}
      <div className="field-card rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#0b111e] text-slate-400 border-b border-[#233044] uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3">Station Code & Name</th>
                <th className="p-3">Zone</th>
                <th className="p-3">Range & Beat</th>
                <th className="p-3">Coordinates</th>
                <th className="p-3">Effort (Trap-nights)</th>
                <th className="p-3">Tiger Captures</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a2537] text-slate-300">
              {filtered.map((st) => {
                const isCore = st.zone === 'core';
                return (
                  <tr key={st.id} className="hover:bg-[#162236] transition">
                    <td className="p-3">
                      <div className="font-semibold text-slate-100 font-mono text-xs">{st.code}</div>
                      <div className="text-[11px] text-slate-400">{st.name}</div>
                    </td>
                    <td className="p-3">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                        isCore ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}>
                        {st.zone}
                      </span>
                    </td>
                    <td className="p-3 text-slate-300">{st.range_beat}</td>
                    <td className="p-3 font-mono text-slate-400 text-[11px]">
                      {st.latitude.toFixed(4)}° N, {st.longitude.toFixed(4)}° E
                    </td>
                    <td className="p-3 font-bold text-slate-100 tabular-nums font-mono">
                      {st.active_trap_nights} nights
                    </td>
                    <td className="p-3 font-bold text-emerald-400 tabular-nums font-mono">
                      {st.sightings_count}
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
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
    </div>
  );
};
