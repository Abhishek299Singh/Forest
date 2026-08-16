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
    <div className="p-4 space-y-4 max-w-[1600px] mx-auto text-xs">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#232834]">
        <div>
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
            <Camera className="w-4 h-4 text-slate-400" />
            <span>Camera Trap Deployment Grid & Survey Effort Matrix</span>
          </h2>
          <p className="text-[11px] text-slate-400">
            Active trap-night counts, operational status, and cumulative tiger captures per deployed camera station.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Search station code or beat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#181d26] border border-[#2a3140] text-slate-100 rounded pl-8 pr-2.5 py-1 text-xs focus:outline-none focus:border-slate-500 w-52 font-sans"
            />
          </div>

          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="bg-[#181d26] border border-[#2a3140] text-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-slate-500"
          >
            <option value="all">All Zones</option>
            <option value="core">Core Sanctuary</option>
            <option value="buffer">Buffer Zone</option>
            <option value="corridor">Corridor Link</option>
          </select>
        </div>
      </div>

      {/* Structured Operational Table */}
      <div className="field-card overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#181d26] text-slate-400 text-[11px] border-b border-[#232834]">
            <tr>
              <th className="p-2.5 font-medium">Station Code & Name</th>
              <th className="p-2.5 font-medium">Zone</th>
              <th className="p-2.5 font-medium">Range & Beat</th>
              <th className="p-2.5 font-medium">Coordinates (WGS 84)</th>
              <th className="p-2.5 font-medium">Active Effort</th>
              <th className="p-2.5 font-medium">Tiger Sightings</th>
              <th className="p-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#232834] text-slate-300">
            {filtered.map((st) => {
              const isCore = st.zone === 'core';
              return (
                <tr key={st.id} className="hover:bg-[#181d26] transition">
                  <td className="p-2.5">
                    <div className="font-semibold text-slate-100 font-mono text-xs">{st.code}</div>
                    <div className="text-[11px] text-slate-400">{st.name}</div>
                  </td>
                  <td className="p-2.5">
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-medium ${
                      isCore ? 'bg-[#1a2e20] text-emerald-300 border border-[#26452f]' : 'bg-[#2a2416] text-amber-300 border border-[#44381e]'
                    }`}>
                      {st.zone.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-2.5 text-slate-300">{st.range_beat}</td>
                  <td className="p-2.5 font-mono text-slate-400 text-[11px]">
                    {st.latitude.toFixed(4)}° N, {st.longitude.toFixed(4)}° E
                  </td>
                  <td className="p-2.5 font-semibold text-slate-100 tabular-nums font-mono">
                    {st.active_trap_nights} trap-nights
                  </td>
                  <td className="p-2.5 font-semibold text-emerald-400 tabular-nums font-mono">
                    {st.sightings_count} records
                  </td>
                  <td className="p-2.5">
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Operational
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
