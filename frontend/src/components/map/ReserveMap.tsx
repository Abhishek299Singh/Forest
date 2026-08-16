import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { CameraStation, TigerSummary, AlertItem } from '../../types';
import { Layers, MapPin, AlertOctagon } from 'lucide-react';

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

  // Layer Visibility Controls
  const [showCore, setShowCore] = useState(true);
  const [showBuffer, setShowBuffer] = useState(true);
  const [showStations, setShowStations] = useState(true);
  const [showTigers, setShowTigers] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);
  const [showVillages, setShowVillages] = useState(true);
  const [selectedFilterTiger, setSelectedFilterTiger] = useState<string>('all');

  // Pench Tiger Reserve Center Coordinates: [79.32, 21.76]
  const PENCH_CENTER: [number, number] = [79.325, 21.758];

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize MapLibre with dark/topo carto raster style for offline & online capability
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
            attribution: '© OpenStreetMap contributors | Pench Forest Dept'
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
              'raster-saturation': -0.7,
              'raster-brightness-min': 0.1,
              'raster-brightness-max': 0.8
            }
          }
        ]
      },
      center: PENCH_CENTER,
      zoom: 10.8,
      attributionControl: false
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapRef.current = map;

    map.on('load', () => {
      // Add GeoJSON boundary layers for Pench Core & Buffer
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

      // Buffer polygon source
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
          'fill-color': '#d97706',
          'fill-opacity': 0.08
        }
      });

      map.addLayer({
        id: 'buffer-outline',
        type: 'line',
        source: 'buffer-boundary',
        paint: {
          'line-color': '#f59e0b',
          'line-width': 2,
          'line-dasharray': [3, 2]
        }
      });

      // Core polygon source
      map.addSource('core-boundary', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [coreCoords] },
          properties: { name: 'Pench Core Tiger Sanctuary' }
        }
      });

      map.addLayer({
        id: 'core-fill',
        type: 'fill',
        source: 'core-boundary',
        paint: {
          'fill-color': '#15803d',
          'fill-opacity': 0.18
        }
      });

      map.addLayer({
        id: 'core-outline',
        type: 'line',
        source: 'core-boundary',
        paint: {
          'line-color': '#22c55e',
          'line-width': 2.5
        }
      });
    });

    return () => {
      map.remove();
    };
  }, [gisData]);

  // Update Markers and Dynamic Elements
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear previous custom HTML markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // 1. Render Camera Stations
    if (showStations && stations.length > 0) {
      stations.forEach((st) => {
        const el = document.createElement('div');
        el.className = 'group relative cursor-pointer';
        
        const isBuffer = st.zone === 'buffer';
        const isCorridor = st.zone === 'corridor';
        const colorClass = isBuffer ? 'bg-amber-500' : isCorridor ? 'bg-purple-500' : 'bg-emerald-500';

        el.innerHTML = `
          <div class="w-6 h-6 rounded-full ${colorClass} text-slate-950 font-bold text-[10px] flex items-center justify-center shadow-lg border-2 border-slate-900 transition-transform group-hover:scale-125">
            ${st.code.replace('ST-', '')}
          </div>
        `;

        el.addEventListener('click', () => {
          onSelectStation?.(st);
        });

        const popup = new maplibregl.Popup({ offset: 12 }).setHTML(`
          <div class="p-1">
            <div class="text-xs font-bold text-emerald-400 uppercase tracking-wide">${st.code} (${st.zone.toUpperCase()})</div>
            <div class="text-sm font-semibold text-slate-100">${st.name}</div>
            <div class="text-xs text-slate-400 mt-1">${st.range_beat} | ${st.habitat}</div>
            <div class="text-xs text-slate-300 mt-2 flex items-center gap-2">
              <span class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200">${st.active_trap_nights} Trap-nights</span>
              <span class="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300">${st.sightings_count} Sightings</span>
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

    // 2. Render Tiger Centroids & Territory Circles
    if (showTigers && tigers.length > 0) {
      tigers.forEach((t, idx) => {
        if (selectedFilterTiger !== 'all' && t.id !== selectedFilterTiger) return;
        if (!t.centroid) return;

        const el = document.createElement('div');
        el.className = 'group relative cursor-pointer';

        const tigerColors = ['#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#10b981', '#f97316'];
        const color = tigerColors[idx % tigerColors.length];

        el.innerHTML = `
          <div class="relative flex items-center justify-center">
            <span class="animate-ping absolute inline-flex h-8 w-8 rounded-full opacity-40" style="background-color: ${color}"></span>
            <div class="w-8 h-8 rounded-full shadow-xl flex items-center justify-center text-xs font-bold border-2 border-slate-900 text-white transition-transform group-hover:scale-125" style="background-color: ${color}">
              🐅
            </div>
            <div class="absolute -bottom-5 whitespace-nowrap px-1.5 py-0.5 rounded bg-slate-900/90 text-[10px] font-semibold text-slate-200 border border-slate-700 pointer-events-none">
              ${t.callsign.split(' ')[0]} (${t.tiger_code})
            </div>
          </div>
        `;

        el.addEventListener('click', () => {
          onSelectTiger?.(t.id);
        });

        const popup = new maplibregl.Popup({ offset: 14 }).setHTML(`
          <div class="p-1">
            <div class="text-xs font-bold text-amber-400 uppercase tracking-wide">${t.tiger_code} • ${t.status.toUpperCase()}</div>
            <div class="text-sm font-semibold text-slate-100">${t.callsign}</div>
            <div class="text-xs text-slate-400 mt-1">${t.sex} | ${t.age_class} | Zone: ${t.primary_zone}</div>
            <div class="text-xs text-slate-300 mt-2">Territory Area: <span class="text-emerald-400 font-bold">${t.territory_area_km2} km²</span></div>
          </div>
        `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([t.centroid.lon, t.centroid.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    }

    // 3. Render Active Movement Alerts
    if (showAlerts && alerts.length > 0) {
      alerts.filter(a => a.status === 'active').forEach((al) => {
        const st = stations.find(s => s.code === al.station_code);
        if (!st) return;

        const el = document.createElement('div');
        el.className = 'group relative cursor-pointer z-30';

        const isCrit = al.severity === 'CRITICAL';
        const color = isCrit ? 'bg-rose-600' : 'bg-amber-600';

        el.innerHTML = `
          <div class="relative flex items-center justify-center">
            <span class="animate-ping absolute inline-flex h-10 w-10 rounded-full ${color} opacity-60"></span>
            <div class="w-7 h-7 rounded-lg ${color} text-white shadow-2xl flex items-center justify-center text-xs font-bold border-2 border-white animate-bounce">
              ⚠️
            </div>
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 16 }).setHTML(`
          <div class="p-1.5 max-w-xs">
            <div class="text-[10px] font-bold px-1.5 py-0.5 rounded inline-block mb-1 ${isCrit ? 'bg-rose-900/80 text-rose-300' : 'bg-amber-900/80 text-amber-300'}">
              ${al.severity} ALERT
            </div>
            <div class="text-sm font-bold text-slate-100">${al.callsign} (${al.tiger_code})</div>
            <div class="text-xs text-slate-300 mt-1">${al.explanation.what_changed}</div>
            <div class="text-[11px] text-slate-400 mt-1.5 italic">Survey Effort: ${al.explanation.survey_effort}</div>
          </div>
        `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([st.longitude, st.latitude])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    }

    // 4. Render Villages
    if (showVillages && gisData?.villages) {
      gisData.villages.forEach((v: any) => {
        const el = document.createElement('div');
        el.className = 'group relative cursor-pointer';

        el.innerHTML = `
          <div class="flex items-center gap-1 bg-slate-900/90 px-1.5 py-0.5 rounded-full border border-slate-700 text-[10px] text-slate-300 shadow-md">
            <span>🏘️</span>
            <span class="font-medium">${v.name}</span>
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
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 flex flex-col">
      {/* Map Header Floating Layer Controls */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 bg-slate-900/90 p-2 rounded-xl border border-slate-800 backdrop-blur-md shadow-xl">
        <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold px-2 border-r border-slate-700">
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <span>Layers</span>
        </div>

        {/* Core Zone Toggle */}
        <button
          onClick={() => setShowCore(!showCore)}
          className={`px-2 py-1 rounded text-xs font-medium transition flex items-center gap-1 ${
            showCore ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/40' : 'bg-slate-800/80 text-slate-400'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          Core Zone
        </button>

        {/* Buffer Zone Toggle */}
        <button
          onClick={() => setShowBuffer(!showBuffer)}
          className={`px-2 py-1 rounded text-xs font-medium transition flex items-center gap-1 ${
            showBuffer ? 'bg-amber-950 text-amber-300 border border-amber-600/40' : 'bg-slate-800/80 text-slate-400'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          Buffer Zone
        </button>

        {/* Stations Toggle */}
        <button
          onClick={() => setShowStations(!showStations)}
          className={`px-2 py-1 rounded text-xs font-medium transition flex items-center gap-1 ${
            showStations ? 'bg-slate-800 text-slate-200 border border-slate-700' : 'bg-slate-800/40 text-slate-400'
          }`}
        >
          <MapPin className="w-3 h-3 text-emerald-400" />
          Stations ({stations.length})
        </button>

        {/* Tigers Toggle */}
        <button
          onClick={() => setShowTigers(!showTigers)}
          className={`px-2 py-1 rounded text-xs font-medium transition flex items-center gap-1 ${
            showTigers ? 'bg-slate-800 text-slate-200 border border-slate-700' : 'bg-slate-800/40 text-slate-400'
          }`}
        >
          <span>🐅</span>
          Tigers ({tigers.length})
        </button>

        {/* Alerts Toggle */}
        <button
          onClick={() => setShowAlerts(!showAlerts)}
          className={`px-2 py-1 rounded text-xs font-medium transition flex items-center gap-1 ${
            showAlerts ? 'bg-rose-950 text-rose-300 border border-rose-600/40' : 'bg-slate-800/40 text-slate-400'
          }`}
        >
          <AlertOctagon className="w-3 h-3 text-rose-400" />
          Alerts
        </button>

        {/* Filter Tiger dropdown */}
        <div className="pl-2 border-l border-slate-700">
          <select
            value={selectedFilterTiger}
            onChange={(e) => setSelectedFilterTiger(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Tigers (Composite)</option>
            {tigers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.tiger_code} - {t.callsign}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Map Canvas Container */}
      <div ref={mapContainerRef} className="w-full h-full flex-1" />

      {/* Map Legend Footer */}
      <div className="absolute bottom-4 left-4 z-20 bg-slate-900/90 px-3 py-2 rounded-xl border border-slate-800 backdrop-blur-md shadow-xl flex items-center gap-4 text-xs text-slate-300">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500 border border-emerald-400"></span>
          <span>Core Stations</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-500 border border-amber-400"></span>
          <span>Buffer Stations</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-purple-500 border border-purple-400"></span>
          <span>Corridor Stations</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-rose-600"></span>
          <span>Movement Alert Beacons</span>
        </div>
        <div className="text-[11px] text-slate-400 pl-2 border-l border-slate-700">
          Pench GPS: 21.758° N, 79.314° E
        </div>
      </div>
    </div>
  );
};
