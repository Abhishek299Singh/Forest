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
  focusCoordinates?: [number, number] | null; // [lon, lat]
  onSelectStation?: (station: CameraStation) => void;
  onSelectTiger?: (tigerId: string) => void;
}

export const ReserveMap: React.FC<ReserveMapProps> = ({
  stations = [],
  tigers = [],
  alerts = [],
  gisData,
  selectedTigerId,
  focusCoordinates,
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
              'raster-saturation': -0.75,
              'raster-hue-rotate': 80,
              'raster-brightness-min': 0.12,
              'raster-brightness-max': 0.75
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

      // Buffer boundary
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
          'fill-opacity': 0.1
        }
      });

      map.addLayer({
        id: 'buffer-outline',
        type: 'line',
        source: 'buffer-boundary',
        paint: {
          'line-color': '#d97706',
          'line-width': 2,
          'line-dasharray': [3, 2]
        }
      });

      // Core boundary
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
          'fill-color': '#166534',
          'fill-opacity': 0.22
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (focusCoordinates && focusCoordinates[0] != null && focusCoordinates[1] != null) {
      map.flyTo({
        center: focusCoordinates,
        zoom: 14,
        essential: true,
      });
    } else if (stations.length > 0) {
      const validSt = stations.find(s => s.latitude != null && s.longitude != null);
      if (validSt) {
        map.flyTo({
          center: [validSt.longitude, validSt.latitude],
          zoom: 12.5,
          essential: true,
        });
      }
    }
  }, [focusCoordinates, stations]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Stations
    if (showStations && stations.length > 0) {
      stations.forEach((st) => {
        if (st.latitude == null || st.longitude == null) return;
        const el = document.createElement('div');
        el.className = 'cursor-pointer';
        
        const isBuffer = st.zone === 'buffer';
        const color = isBuffer ? '#d97706' : '#10b981';

        el.innerHTML = `
          <div style="background-color: ${color};" class="w-5 h-5 rounded-full text-[#07100a] font-bold text-[9px] flex items-center justify-center border border-[#07100a] shadow-md font-mono">
            ${st.code.replace('ST-', '')}
          </div>
        `;

        el.addEventListener('click', () => onSelectStation?.(st));

        const popup = new maplibregl.Popup({ offset: 10 }).setHTML(`
          <div class="text-xs">
            <div class="font-bold text-emerald-400 font-mono">${st.code} (${st.zone.toUpperCase()})</div>
            <div class="font-semibold text-emerald-100">${st.name}</div>
            <div class="text-emerald-400 text-[11px] mt-0.5">${st.range_beat || 'Turia Range'}</div>
            <div class="text-[11px] text-emerald-200 mt-1.5 pt-1 border-t border-[#1c3525] flex justify-between">
              <span>${st.active_trap_nights || 0} Trap-nights</span>
              <span class="text-emerald-400 font-bold">${st.sightings_count || 0} Captures</span>
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
      tigers.forEach((t) => {
        if (selectedFilterTiger !== 'all' && t.id !== selectedFilterTiger) return;
        if (!t.centroid || t.centroid.lat == null || t.centroid.lon == null) return;

        const el = document.createElement('div');
        el.className = 'cursor-pointer';

        el.innerHTML = `
          <div class="relative flex items-center justify-center">
            <div class="w-6 h-6 rounded-full bg-[#1b221d] border-2 border-amber-500 flex items-center justify-center shadow-lg font-mono text-[9px] font-bold text-amber-300">
              ID
            </div>
            <div class="absolute -bottom-4 whitespace-nowrap px-1 py-0.2 rounded bg-[#07100a] text-[9px] font-mono text-amber-300 border border-[#1c3525]">
              ${t.tiger_code}
            </div>
          </div>
        `;

        el.addEventListener('click', () => onSelectTiger?.(t.id));

        const popup = new maplibregl.Popup({ offset: 12 }).setHTML(`
          <div class="text-xs">
            <div class="font-bold text-amber-400 font-mono">${t.tiger_code} (${t.status.toUpperCase()})</div>
            <div class="font-semibold text-emerald-100">${t.callsign}</div>
            <div class="text-emerald-400 text-[11px] mt-0.5">${t.sex || 'Unknown'} • ${t.age_class || 'Adult'} • Range: ${t.primary_zone}</div>
            <div class="text-emerald-200 mt-1 pt-1 border-t border-[#1c3525]">Territory: <strong class="text-emerald-400">${t.territory_area_km2 || 0} km²</strong></div>
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
        if (!st || st.latitude == null || st.longitude == null) return;

        const el = document.createElement('div');
        el.className = 'cursor-pointer z-30';
        const isCrit = al.severity === 'CRITICAL';
        const bg = isCrit ? 'bg-rose-600' : 'bg-amber-600';

        el.innerHTML = `
          <div class="w-5 h-5 rounded ${bg} text-white font-bold text-[10px] flex items-center justify-center border border-white shadow-lg font-mono">
            !
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 12 }).setHTML(`
          <div class="text-xs max-w-xs">
            <div class="font-bold font-mono text-[10px] ${isCrit ? 'text-rose-400' : 'text-amber-400'}">${al.severity} MOVEMENT ALERT</div>
            <div class="font-bold text-emerald-100 mt-0.5">${al.callsign} (${al.tiger_code})</div>
            <div class="text-emerald-200 text-[11px] mt-1">${al.explanation.what_changed}</div>
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
          <div class="bg-[#0c1a11]/90 px-1.5 py-0.5 rounded border border-[#1c3525] text-[9px] text-emerald-200 font-medium shadow">
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
    <div className="relative w-full h-full bg-[#07100a] flex flex-col">
      {/* Floating Toolbar */}
      <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1.5 bg-[#0c1a11]/95 p-1.5 rounded border border-[#1c3525] shadow text-xs">
        <div className="flex items-center gap-1 text-emerald-200 font-medium px-1.5 border-r border-[#1c3525]">
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <span>Layers</span>
        </div>

        <button
          onClick={() => setShowCore(!showCore)}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
            showCore ? 'bg-[#162b1e] text-emerald-300 border border-[#2d523b]' : 'bg-[#07100a] text-emerald-600'
          }`}
        >
          Core Sanctuary
        </button>

        <button
          onClick={() => setShowBuffer(!showBuffer)}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
            showBuffer ? 'bg-[#2c1e15] text-amber-300 border border-[#5e3f2b]' : 'bg-[#07100a] text-emerald-600'
          }`}
        >
          Buffer Zone
        </button>

        <button
          onClick={() => setShowStations(!showStations)}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
            showStations ? 'bg-[#122417] text-emerald-200 border border-[#1c3525]' : 'bg-[#07100a] text-emerald-600'
          }`}
        >
          Stations ({stations.length})
        </button>

        <button
          onClick={() => setShowTigers(!showTigers)}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
            showTigers ? 'bg-[#122417] text-emerald-200 border border-[#1c3525]' : 'bg-[#07100a] text-emerald-600'
          }`}
        >
          Tigers ({tigers.length})
        </button>

        <button
          onClick={() => setShowAlerts(!showAlerts)}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
            showAlerts ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-[#07100a] text-emerald-600'
          }`}
        >
          Alerts
        </button>

        <div className="pl-1 border-l border-[#1c3525]">
          <select
            value={selectedFilterTiger}
            onChange={(e) => setSelectedFilterTiger(e.target.value)}
            className="bg-[#07100a] border border-[#1c3525] text-emerald-200 text-[11px] rounded px-1.5 py-0.5 focus:outline-none"
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
      <div className="absolute bottom-3 left-3 z-20 bg-[#0c1a11]/95 px-3 py-1.5 rounded border border-[#1c3525] flex items-center gap-3 text-[11px] text-emerald-200">
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
        <div className="text-emerald-400 pl-2 border-l border-[#1c3525] font-mono">
          21.758° N, 79.314° E
        </div>
      </div>
    </div>
  );
};
