import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api/client';
import { TigerSummary, CameraStation, AlertItem, TerritoryOverlap } from '../types';
import { ReserveMap } from '../components/map/ReserveMap';
import { Map, Activity } from 'lucide-react';

export const MapPage: React.FC = () => {
  const [stations, setStations] = useState<CameraStation[]>([]);
  const [tigers, setTigers] = useState<TigerSummary[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [overlaps, setOverlaps] = useState<TerritoryOverlap[]>([]);
  const [gisData, setGisData] = useState<any>(null);
  const [selectedStation, setSelectedStation] = useState<CameraStation | null>(null);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [stRes, tRes, alRes, ovRes, gisRes] = await Promise.all([
          ApiClient.getStations(),
          ApiClient.getTigers(),
          ApiClient.getAlerts(),
          ApiClient.getTerritoryOverlaps(),
          ApiClient.getGIS(),
        ]);
        setStations(stRes);
        setTigers(tRes);
        setAlerts(alRes);
        setOverlaps(ovRes);
        setGisData(gisRes?.data);
      } catch (_) {}
    };
    loadAll();
  }, []);

  return (
    <div className="p-5 space-y-4 max-w-[1600px] mx-auto flex flex-col h-[calc(100vh-4.5rem)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#233044]">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Map className="w-5 h-5 text-emerald-400" />
            <span>Pench Tiger Reserve Geospatial Intelligence Map</span>
          </h2>
          <p className="text-xs text-slate-400">
            Core Sanctuary boundary, Buffer multi-use zone, camera trap layout, and Minimum Convex Polygon (MCP 95%) territory overlaps.
          </p>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Pench Central: <strong className="text-slate-200 font-mono">21.758° N, 79.314° E</strong>
        </div>
      </div>

      {/* Main Map + Side Overlap Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 min-h-0">
        {/* Left 3 Cols: MapLibre Map */}
        <div className="lg:col-span-3 h-full rounded border border-[#233044] overflow-hidden">
          <ReserveMap
            stations={stations}
            tigers={tigers}
            alerts={alerts}
            gisData={gisData}
            onSelectStation={(st) => setSelectedStation(st)}
          />
        </div>

        {/* Right 1 Col: Station details & Overlaps */}
        <div className="space-y-3 flex flex-col min-h-0 overflow-y-auto text-xs">
          {selectedStation && (
            <div className="field-card p-3 space-y-1.5 border-emerald-500/40">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-400 font-mono">{selectedStation.code}</span>
                <span className="text-[9px] uppercase font-bold font-mono px-1.5 py-0.2 rounded bg-[#0b111e] text-slate-300">
                  {selectedStation.zone}
                </span>
              </div>
              <div className="font-semibold text-slate-100">{selectedStation.name}</div>
              <p className="text-[11px] text-slate-400">{selectedStation.range_beat} • {selectedStation.habitat}</p>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1a2537] text-[11px]">
                <div>
                  <span className="text-slate-400">Effort</span>
                  <div className="font-bold text-slate-200 mt-0.5">{selectedStation.active_trap_nights} nights</div>
                </div>
                <div>
                  <span className="text-slate-400">Sightings</span>
                  <div className="font-bold text-emerald-400 mt-0.5">{selectedStation.sightings_count} captures</div>
                </div>
              </div>
            </div>
          )}

          {/* Territory Overlap Matrix */}
          <div className="field-card p-3 flex-1 flex flex-col space-y-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-[#233044]">
              <div className="flex items-center gap-1.5 font-bold text-slate-200 text-[11px] uppercase tracking-wider">
                <Activity className="w-3.5 h-3.5 text-purple-400" />
                <span>Territory Overlaps</span>
              </div>
              <span className="text-[9px] font-mono text-slate-400 bg-[#0b111e] px-1.5 py-0.2 rounded">MCP 95%</span>
            </div>

            <div className="space-y-2 overflow-y-auto flex-1 pr-1">
              {overlaps.length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-xs">
                  Calculating territorial polygon intersections...
                </div>
              ) : (
                overlaps.map((ov, idx) => (
                  <div key={idx} className="p-2.5 bg-[#0b111e] rounded border border-[#233044] space-y-1">
                    <div className="flex items-center justify-between font-bold text-slate-200">
                      <span>{ov.tiger_a_code} ↔ {ov.tiger_b_code}</span>
                      <span className="text-purple-400 font-mono">{ov.overlap_km2} km²</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {ov.tiger_a_callsign} & {ov.tiger_b_callsign}
                    </div>
                    <div className="w-full bg-[#162032] h-1 rounded-full overflow-hidden mt-1">
                      <div
                        className="bg-purple-500 h-full"
                        style={{ width: `${Math.min(100, ov.overlap_pct_a)}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center justify-between">
                      <span>{ov.tiger_a_code}: {ov.overlap_pct_a}%</span>
                      <span>{ov.tiger_b_code}: {ov.overlap_pct_b}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
