import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { CameraStation, TigerSummary, AlertItem } from '../../types';
import { Layers, MapPin, AlertOctagon, Compass } from 'lucide-react';

interface ReserveMapProps {
  stations?: CameraStation[];
  tigers?: TigerSummary[];
  alerts?: AlertItem[];
  gisData?: any;
  selectedTigerId?: string | null;
  onSelectStation?: (station: CameraStation) => void;
  onSelectTiger?: (tigerId: string) => void;
}

export const ReserveMap: React.FC<ReserveMapProps> = ({
  stations = [],
  tigers = [],
  alerts = [],
  gisData,
  selectedTigerId,
  onSelectStation,
  onSelectTiger,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [showCore, setShowCore] = useState(true);
  const [showBuffer, setShowBuffer] = useState(true);
  const [showStations, setShowStations] = useState(true);
  const [showTigers, setShowTigers] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);
  const [showVillages, setShowVillages] = useState(true);
  const [selectedFilterTiger, setSelectedFilterTiger] = useState<string>('all');

  const PENCH_CENTER: [number, number] = [79.325, 21.758];

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: [
              'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap | Pench Forest Dept'
          }
        },
        layers: [
          {
            id: 'osm-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19,
            paint: {
              'raster-saturation': -0.85,
              'raster-brightness-min': 0.15,
              'raster-brightness-max': 0.8
            }
          }
        ]
      },
      center: PENCH_CENTER,
      zoom: 10.8,
      attributionControl: false
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    mapRef.current = map;

    map.on('load', () => {
      const coreCoords = gisData?.core_polygon || [
        [79.22, 21.68], [79.25, 21.85], [79.38, 21.90],
        [79.48, 21.82], [79.45, 21.68], [79.32, 21.62],
        [79.22, 21.68]
      ];

      const bufferCoords = gisData?.buffer_polygon || [
        [79.15, 21.60], [79.18, 21.92], [79.42, 21.98],
        [79.55, 21.88], [79.52, 21.62], [79.30, 21.55],
        [79.15, 21.60]
      ];

      map.addSource('buffer-boundary', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [bufferCoords] },
          properties: { name: 'Pench Buffer Zone' }
        }
      });

      map.addLayer({
        id: 'buffer-fill',
        type: 'fill',
        source: 'buffer-boundary',
        paint: {
          'fill-color': '#b45309',
          'fill-opacity': 0.08
        }
      });

      map.addLayer({
        id: 'buffer-outline',
        type: 'line',
        source: 'buffer-boundary',
        paint: {
          'line-color': '#d97706',
          'line-width': 1.5,
          'line-dasharray': [3, 2]
        }
      });

      map.addSource('core-boundary', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [coreCoords] },
          properties: { name: 'Pench Core Sanctuary' }
        }
      });

      map.addLayer({
        id: 'core-fill',
        type: 'fill',
        source: 'core-boundary',
        paint: {
          'fill-color': '#15803d',
          'fill-opacity': 0.15
        }
      });

      map.addLayer({
        id: 'core-outline',
        type: 'line',
        source: 'core-boundary',
        paint: {
          'line-color': '#22c55e',
          'line-width': 2
        }
      });
    });

    return () => {
      map.remove();
    };
  }, [gisData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Stations
    if (showStations && stations.length > 0) {
      stations.forEach((st) => {
        const el = document.createElement('div');
        el.className = 'cursor-pointer';
        
        const isBuffer = st.zone === 'buffer';
        const color = isBuffer ? '#d97706' : '#10b981';

        el.innerHTML = `
          <div style="background-color: ${color};" class="w-5 h-5 rounded-full text-black font-bold text-[9px] flex items-center justify-center border border-black shadow">
            ${st.code.replace('ST-', '')}
          </div>
        `;

        el.addEventListener('click', () => onSelectStation?.(st));

        const popup = new maplibregl.Popup({ offset: 10 }).setHTML(`
          <div class="text-xs">
            <div class="font-bold text-emerald-400 font-mono">${st.code} (${st.zone.toUpperCase()})</div>
            <div class="font-semibold text-slate-100">${st.name}</div>
            <div class="text-slate-400 text-[11px] mt-0.5">${st.range_beat} • ${st.habitat}</div>
            <div class="text-[11px] text-slate-300 mt-1.5 pt-1 border-t border-[#233044] flex justify-between">
              <span>${st.active_trap_nights} Trap-nights</span>
              <span class="text-emerald-400 font-bold">${st.sightings_count} Captures</span>
            </div>
          </div>
        `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([st.longitude, st.latitude])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    }

    // Tigers
    if (showTigers && tigers.length > 0) {
      tigers.forEach((t, idx) => {
        if (selectedFilterTiger !== 'all' && t.id !== selectedFilterTiger) return;
        if (!t.centroid) return;

        const el = document.createElement('div');
        el.className = 'cursor-pointer';

        el.innerHTML = `
          <div class="relative flex items-center justify-center">
            <div class="w-7 h-7 rounded-full bg-[#1b2b3a] border border-amber-500 flex items-center justify-center text-xs shadow-lg">
              🐅
            </div>
            <div class="absolute -bottom-4 whitespace-nowrap px-1 py-0.2 rounded bg-[#0b111e] text-[9px] font-mono text-amber-300 border border-[#233044]">
              ${t.tiger_code}
            </div>
          </div>
        `;

        el.addEventListener('click', () => onSelectTiger?.(t.id));

        const popup = new maplibregl.Popup({ offset: 12 }).setHTML(`
          <div class="text-xs">
            <div class="font-bold text-amber-400 font-mono">${t.tiger_code} (${t.status.toUpperCase()})</div>
            <div class="font-semibold text-slate-100">${t.callsign}</div>
            <div class="text-slate-400 text-[11px] mt-0.5">${t.sex} • ${t.age_class} • Range: ${t.primary_zone}</div>
            <div class="text-slate-300 mt-1 pt-1 border-t border-[#233044]">Territory: <strong class="text-emerald-400">${t.territory_area_km2} km²</strong></div>
          </div>
        `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([t.centroid.lon, t.centroid.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    }

    // Alerts
    if (showAlerts && alerts.length > 0) {
      alerts.filter(a => a.status === 'active').forEach((al) => {
        const st = stations.find(s => s.code === al.station_code);
        if (!st) return;

        const el = document.createElement('div');
        el.className = 'cursor-pointer z-30';
        const isCrit = al.severity === 'CRITICAL';
        const bg = isCrit ? 'bg-rose-600' : 'bg-amber-600';

        el.innerHTML = `
          <div class="w-6 h-6 rounded ${bg} text-white font-bold text-[10px] flex items-center justify-center border border-white shadow-lg">
            ⚠️
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 12 }).setHTML(`
          <div class="text-xs max-w-xs">
            <div class="font-bold font-mono text-[10px] ${isCrit ? 'text-rose-400' : 'text-amber-400'}">${al.severity} MOVEMENT ALERT</div>
            <div class="font-bold text-slate-100 mt-0.5">${al.callsign} (${al.tiger_code})</div>
            <div class="text-slate-300 text-[11px] mt-1">${al.explanation.what_changed}</div>
          </div>
        `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([st.longitude, st.latitude])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    }

    // Villages
    if (showVillages && gisData?.villages) {
      gisData.villages.forEach((v: any) => {
        const el = document.createElement('div');
        el.className = 'cursor-pointer';
        el.innerHTML = `
          <div class="bg-[#0b111e]/90 px-1.5 py-0.5 rounded border border-[#233044] text-[9px] text-slate-300 font-medium shadow">
            🏘️ ${v.name}
          </div>
        `;

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(v.coordinates)
          .addTo(map);

        markersRef.current.push(marker);
      });
    }
  }, [
    stations, tigers, alerts, gisData, showStations, showTigers,
    showAlerts, showVillages, selectedFilterTiger, onSelectStation, onSelectTiger
  ]);

  return (
    <div className="relative w-full h-full bg-[#0b111e] flex flex-col">
      {/* Floating Toolbar */}
      <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1.5 bg-[#111827]/95 p-1.5 rounded border border-[#233044] shadow text-xs">
        <div className="flex items-center gap-1 text-slate-300 font-medium px-1.5 border-r border-[#233044]">
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <span>Layers</span>
        </div>

        <button
          onClick={() => setShowCore(!showCore)}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
            showCore ? 'bg-[#1b3d2b] text-emerald-300 border border-[#2d6144]' : 'bg-[#0b111e] text-slate-400'
          }`}
        >
          Core Sanctuary
        </button>

        <button
          onClick={() => setShowBuffer(!showBuffer)}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
            showBuffer ? 'bg-[#3d2c12] text-amber-300 border border-[#61471b]' : 'bg-[#0b111e] text-slate-400'
          }`}
        >
          Buffer Zone
        </button>

        <button
          onClick={() => setShowStations(!showStations)}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
            showStations ? 'bg-[#162236] text-slate-200 border border-[#233044]' : 'bg-[#0b111e] text-slate-400'
          }`}
        >
          Stations ({stations.length})
        </button>

        <button
          onClick={() => setShowTigers(!showTigers)}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
            showTigers ? 'bg-[#162236] text-slate-200 border border-[#233044]' : 'bg-[#0b111e] text-slate-400'
          }`}
        >
          Tigers ({tigers.length})
        </button>

        <button
          onClick={() => setShowAlerts(!showAlerts)}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
            showAlerts ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-[#0b111e] text-slate-400'
          }`}
        >
          Alerts
        </button>

        <div className="pl-1 border-l border-[#233044]">
          <select
            value={selectedFilterTiger}
            onChange={(e) => setSelectedFilterTiger(e.target.value)}
            className="bg-[#0b111e] border border-[#233044] text-slate-200 text-[11px] rounded px-1.5 py-0.5 focus:outline-none"
          >
            <option value="all">All Tigers</option>
            {tigers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.tiger_code} ({t.callsign})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full flex-1" />

      {/* Bottom Coordinates & Legend */}
      <div className="absolute bottom-3 left-3 z-20 bg-[#111827]/95 px-3 py-1.5 rounded border border-[#233044] flex items-center gap-3 text-[11px] text-slate-300">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span>Core</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          <span>Buffer</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-rose-600"></span>
          <span>Alert</span>
        </div>
        <div className="text-slate-400 pl-2 border-l border-[#233044] font-mono">
          21.758° N, 79.314° E
        </div>
      </div>
    </div>
  );
};
