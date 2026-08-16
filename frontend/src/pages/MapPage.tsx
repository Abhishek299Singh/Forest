import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api/client';
import { TigerSummary, CameraStation, AlertItem, TerritoryOverlap } from '../types';
import { ReserveMap } from '../components/map/ReserveMap';
import { Map, Layers, Compass, MapPin, Activity, HelpCircle, Shield } from 'lucide-react';

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
    <div className="p-6 space-y-6 max-w-7xl mx-auto flex flex-col h-[calc(100vh-5rem)]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <Map className="w-6 h-6 text-emerald-400" />
            <span>Interactive Reserve GIS Intelligence Map</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Core sanctuary boundaries, multi-use buffer zones, camera trap grid, MCP 95% home range footprints, and territory overlap.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            Grid Coordinates: <strong className="text-emerald-400 font-mono">21.758° N, 79.314° E (Pench Core)</strong>
          </span>
        </div>
      </div>

      {/* Main Map + Side Overlap Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        {/* Left 3 Cols: MapLibre GL Map */}
        <div className="lg:col-span-3 h-full rounded-2xl overflow-hidden shadow-2xl">
          <ReserveMap
            stations={stations}
            tigers={tigers}
            alerts={alerts}
            gisData={gisData}
            onSelectStation={(st) => setSelectedStation(st)}
          />
        </div>

        {/* Right 1 Col: Territory Overlap & Station Inspector */}
        <div className="space-y-4 flex flex-col min-h-0 overflow-y-auto">
          {/* Station Inspector if clicked */}
          {selectedStation && (
            <div className="glass-panel p-4 rounded-2xl space-y-2 border-emerald-500/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400">{selectedStation.code}</span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                  {selectedStation.zone}
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-100">{selectedStation.name}</h4>
              <p className="text-xs text-slate-400">{selectedStation.range_beat} • {selectedStation.habitat}</p>
              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800">
                <div className="bg-slate-950 p-2 rounded-lg">
                  <span className="text-slate-400">Effort</span>
                  <div className="font-bold text-slate-200">{selectedStation.active_trap_nights} Trap-nights</div>
                </div>
                <div className="bg-slate-950 p-2 rounded-lg">
                  <span className="text-slate-400">Sightings</span>
                  <div className="font-bold text-emerald-400">{selectedStation.sightings_count} Captures</div>
                </div>
              </div>
            </div>
          )}

          {/* Territory Overlap Matrix */}
          <div className="glass-panel p-4 rounded-2xl flex-1 flex flex-col space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-purple-400" />
                <span>Inter-Individual Territory Overlaps</span>
              </h3>
              <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">MCP 95%</span>
            </div>

            <div className="space-y-2.5 overflow-y-auto flex-1 pr-1 text-xs">
              {overlaps.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  Calculating territory intersections...
                </div>
              ) : (
                overlaps.map((ov, idx) => (
                  <div key={idx} className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between font-bold text-slate-200">
                      <span>{ov.tiger_a_code} ↔ {ov.tiger_b_code}</span>
                      <span className="text-purple-400 font-bold">{ov.overlap_km2} km²</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {ov.tiger_a_callsign} & {ov.tiger_b_callsign}
                    </div>
                    <div className="w-full bg-slate-850 h-1.5 rounded-full overflow-hidden mt-1">
                      <div
                        className="bg-purple-500 h-full rounded-full"
                        style={{ width: `${Math.min(100, ov.overlap_pct_a)}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center justify-between">
                      <span>Overlap of {ov.tiger_a_code}: {ov.overlap_pct_a}%</span>
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
