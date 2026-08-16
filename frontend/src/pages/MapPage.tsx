import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api/client';
import { TigerSummary, CameraStation, AlertItem, TerritoryOverlap } from '../types';
import { ReserveMap } from '../components/map/ReserveMap';
import { Map, Activity, Layers, MapPin } from 'lucide-react';

interface MapPageProps {
  initialFocus?: { lat?: number; lon?: number; station?: string } | null;
}

export const MapPage: React.FC<MapPageProps> = ({ initialFocus }) => {
  const [stations, setStations] = useState<CameraStation[]>([]);
  const [tigers, setTigers] = useState<TigerSummary[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [overlaps, setOverlaps] = useState<TerritoryOverlap[]>([]);
  const [gisData, setGisData] = useState<any>(null);
  const [selectedStation, setSelectedStation] = useState<CameraStation | null>(null);

  const focusCoords: [number, number] | null = (initialFocus?.lon != null && initialFocus?.lat != null)
    ? [initialFocus.lon, initialFocus.lat]
    : null;

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

        if (initialFocus?.station) {
          const matched = stRes.find((s: CameraStation) => s.code === initialFocus.station);
          if (matched) setSelectedStation(matched);
        }
      } catch (_) {}
    };
    loadAll();
  }, [initialFocus]);

  return (
    <div className="p-4 space-y-3 max-w-[1700px] mx-auto flex flex-col h-[calc(100vh-3.5rem)] text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#232834]">
        <div>
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
            <Map className="w-4 h-4 text-slate-400" />
            <span>Pench Tiger Reserve Geospatial Map</span>
          </h2>
          <p className="text-[11px] text-slate-400">
            Core Sanctuary boundary, Buffer zone, camera trap layout, and Minimum Convex Polygon (MCP 95%) territory overlaps.
          </p>
        </div>

        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-3">
          <span>Center: 21.7584° N, 79.3142° E</span>
          <span>•</span>
          <span>Datum: WGS 84</span>
        </div>
      </div>

      {/* Main Full-Height Map + Side Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 flex-1 min-h-0">
        {/* Left 3 Cols: MapLibre Map (Dominates View) */}
        <div className="lg:col-span-3 h-full rounded border border-[#232834] overflow-hidden relative">
          <ReserveMap
            stations={stations}
            tigers={tigers}
            alerts={alerts}
            gisData={gisData}
            onSelectStation={(st) => setSelectedStation(st)}
          />
        </div>

        {/* Right 1 Col: Station details & Overlaps */}
        <div className="space-y-3 flex flex-col min-h-0 overflow-y-auto">
          {/* Station Details Drawer */}
          {selectedStation && (
            <div className="field-card p-3 space-y-2 border-[#313848]">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 font-mono">{selectedStation.code}</span>
                <span className={`text-[9px] uppercase font-mono px-1.5 py-0.2 rounded font-semibold ${
                  selectedStation.zone === 'core' ? 'bg-[#1a2e20] text-emerald-300 border border-[#26452f]' : 'bg-[#2a2416] text-amber-300 border border-[#44381e]'
                }`}>
                  {selectedStation.zone} zone
                </span>
              </div>
              <div className="font-medium text-slate-100 text-xs">{selectedStation.name}</div>
              <p className="text-[11px] text-slate-400">{selectedStation.range_beat} • {selectedStation.habitat}</p>
              
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#232834] text-[11px]">
                <div>
                  <span className="text-slate-400">Survey Effort</span>
                  <div className="font-semibold text-slate-200 mt-0.5 font-mono">{selectedStation.active_trap_nights} trap-nights</div>
                </div>
                <div>
                  <span className="text-slate-400">Tiger Captures</span>
                  <div className="font-semibold text-emerald-400 mt-0.5 font-mono">{selectedStation.sightings_count} records</div>
                </div>
              </div>
            </div>
          )}

          {/* Territory Overlap Matrix */}
          <div className="field-card p-3 flex-1 flex flex-col space-y-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-[#232834]">
              <span className="font-semibold text-slate-200 text-xs">
                Territory Overlap Matrix
              </span>
              <span className="text-[9px] font-mono text-slate-400 bg-[#181d26] px-1.5 py-0.2 rounded border border-[#232834]">
                MCP 95%
              </span>
            </div>

            <div className="space-y-2 overflow-y-auto flex-1 pr-1">
              {overlaps.length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-xs">
                  No overlapping territories detected in current active subset.
                </div>
              ) : (
                overlaps.map((ov, idx) => (
                  <div key={idx} className="p-2 bg-[#181d26] rounded border border-[#232834] space-y-1">
                    <div className="flex items-center justify-between font-semibold text-slate-200">
                      <span>{ov.tiger_a_code} ↔ {ov.tiger_b_code}</span>
                      <span className="text-amber-400 font-mono text-[11px]">{ov.overlap_km2} km²</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {ov.tiger_a_callsign} & {ov.tiger_b_callsign}
                    </div>
                    <div className="w-full bg-[#11141a] h-1 rounded-full overflow-hidden mt-1">
                      <div
                        className="bg-emerald-500 h-full"
                        style={{ width: `${Math.min(100, ov.overlap_pct_a)}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center justify-between font-mono">
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
