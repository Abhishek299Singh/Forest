import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { CameraStation, TigerSummary, AlertItem, DetectionResult, TigerMovementTrack } from '../../types';
import { resolveMediaUrl } from '../../api/client';
import { Layers, MapPin, AlertOctagon, Camera, Eye } from 'lucide-react';

interface ReserveMapProps {
  stations?: CameraStation[];
  tigers?: TigerSummary[];
  alerts?: AlertItem[];
  detections?: any[];
  tracks?: TigerMovementTrack[];
  gisData?: any;
  selectedTigerId?: string | null;
  focusCoordinates?: [number, number] | null; // [lon, lat]
  onSelectStation?: (station: CameraStation) => void;
  onSelectTiger?: (tigerId: string) => void;
  onInspectImage?: (imageId: string) => void;
}

export const ReserveMap: React.FC<ReserveMapProps> = ({
  stations = [],
  tigers = [],
  alerts = [],
  detections = [],
  tracks = [],
  gisData,
  selectedTigerId,
  focusCoordinates,
  onSelectStation,
  onSelectTiger,
  onInspectImage,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [showCore, setShowCore] = useState(true);
  const [showBuffer, setShowBuffer] = useState(true);
  const [showStations, setShowStations] = useState(true);
  const [showDetections, setShowDetections] = useState(true);
  const [showPaths, setShowPaths] = useState(true);
  const [showRanges, setShowRanges] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);
  const [selectedFilterTiger, setSelectedFilterTiger] = useState<string>('all');
  const [basemapType, setBasemapType] = useState<'osm' | 'topo' | 'satellite'>('osm');

  const PENCH_CENTER: [number, number] = [79.325, 21.758];

  const getTileUrl = (type: 'osm' | 'topo' | 'satellite') => {
    switch (type) {
      case 'topo':
        return 'https://tile.opentopomap.org/{z}/{x}/{y}.png';
      case 'satellite':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'osm':
      default:
        return 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    }
  };

  const TRACK_COLORS = ['#f59e0b', '#10b981', '#38bdf8', '#ec4899', '#a855f7', '#fb923c'];

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: [getTileUrl(basemapType)],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors | Pench Wildlife Intelligence'
          }
        },
        layers: [
          {
            id: 'osm-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19
          }
        ]
      },
      center: PENCH_CENTER,
      zoom: 11,
      attributionControl: { compact: false }
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
          'fill-opacity': 0.08
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
  }, [gisData, basemapType]);

  // Auto Bounds Calculation & Focus Coordinates
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (focusCoordinates && focusCoordinates[0] != null && focusCoordinates[1] != null) {
      map.flyTo({
        center: focusCoordinates,
        zoom: 14.5,
        essential: true,
      });
      return;
    }

    // Auto-calculate bounds from all active coordinates
    const bounds = new maplibregl.LngLatBounds();
    let pointCount = 0;

    stations.forEach((st) => {
      if (st.latitude != null && st.longitude != null) {
        bounds.extend([st.longitude, st.latitude]);
        pointCount++;
      }
    });

    detections.forEach((d) => {
      if (d.latitude != null && d.longitude != null) {
        bounds.extend([d.longitude, d.latitude]);
        pointCount++;
      }
    });

    tracks.forEach((t) => {
      t.points?.forEach((p) => {
        if (p.latitude != null && p.longitude != null) {
          bounds.extend([p.longitude, p.latitude]);
          pointCount++;
        }
      });
    });

    if (pointCount > 0) {
      map.fitBounds(bounds, {
        padding: 50,
        maxZoom: 14,
        duration: 800
      });
    }
  }, [focusCoordinates, stations, detections, tracks]);

  // Render Movement Paths & Observed Range Polygons
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Clean previous tracks & ranges
    ['tiger-paths', 'tiger-ranges'].forEach((sourceId) => {
      if (map.getLayer(`${sourceId}-line`)) map.removeLayer(`${sourceId}-line`);
      if (map.getLayer(`${sourceId}-fill`)) map.removeLayer(`${sourceId}-fill`);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    });

    // 1. Movement Paths GeoJSON
    if (showPaths && tracks.length > 0) {
      const pathFeatures: any[] = [];
      tracks.forEach((track, idx) => {
        if (selectedFilterTiger !== 'all' && track.tiger_id !== selectedFilterTiger && track.tiger_code !== selectedFilterTiger) return;
        if (!track.points || track.points.length < 2) return;

        const coords = track.points.map((p) => [p.longitude, p.latitude]);
        const color = TRACK_COLORS[idx % TRACK_COLORS.length];

        pathFeatures.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: {
            tiger_id: track.tiger_id,
            tiger_code: track.tiger_code,
            callsign: track.callsign,
            color: color
          }
        });
      });

      if (pathFeatures.length > 0) {
        map.addSource('tiger-paths', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: pathFeatures }
        });

        map.addLayer({
          id: 'tiger-paths-line',
          type: 'line',
          source: 'tiger-paths',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 3.5,
            'line-opacity': 0.85
          }
        });
      }
    }

    // 2. Observed Range Polygons GeoJSON
    if (showRanges && tracks.length > 0) {
      const rangeFeatures: any[] = [];
      tracks.forEach((track, idx) => {
        if (selectedFilterTiger !== 'all' && track.tiger_id !== selectedFilterTiger && track.tiger_code !== selectedFilterTiger) return;
        if (!track.can_calculate_range || !track.hull_polygon || track.hull_polygon.length < 3) return;

        const color = TRACK_COLORS[idx % TRACK_COLORS.length];
        rangeFeatures.push({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [track.hull_polygon] },
          properties: {
            tiger_id: track.tiger_id,
            tiger_code: track.tiger_code,
            color: color
          }
        });
      });

      if (rangeFeatures.length > 0) {
        map.addSource('tiger-ranges', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: rangeFeatures }
        });

        map.addLayer({
          id: 'tiger-ranges-fill',
          type: 'fill',
          source: 'tiger-ranges',
          paint: {
            'fill-color': ['get', 'color'],
            'fill-opacity': 0.15
          }
        });

        map.addLayer({
          id: 'tiger-ranges-line',
          type: 'line',
          source: 'tiger-ranges',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 2,
            'line-dasharray': [2, 2]
          }
        });
      }
    }
  }, [tracks, showPaths, showRanges, selectedFilterTiger]);

  // Render Interactive Map Markers (Cameras, Detections, Alerts)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // 1. Camera Stations Markers (📷 Icon)
    if (showStations && stations.length > 0) {
      stations.forEach((st) => {
        if (st.latitude == null || st.longitude == null) return;
        const el = document.createElement('div');
        el.className = 'cursor-pointer group';

        const isBuffer = st.zone === 'buffer';
        const borderColor = isBuffer ? '#d97706' : '#10b981';

        el.innerHTML = `
          <div style="border-color: ${borderColor};" class="w-7 h-7 rounded-full bg-[#0d1015] border-2 flex items-center justify-center shadow-lg transition-transform transform group-hover:scale-110">
            <span class="text-xs">📷</span>
          </div>
          <div class="absolute -bottom-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap px-1 py-0.2 rounded bg-[#0d1015]/90 text-[8px] font-mono text-slate-300 border border-[#2a3140]">
            ${st.code}
          </div>
        `;

        el.addEventListener('click', () => onSelectStation?.(st));

        const popup = new maplibregl.Popup({ offset: 12, className: 'dark-popup' }).setHTML(`
          <div class="p-2 text-xs space-y-1.5 min-w-[180px]">
            <div class="flex items-center justify-between border-b border-[#2a3140] pb-1">
              <span class="font-bold text-emerald-400 font-mono">📷 ${st.code}</span>
              <span class="text-[9px] font-mono px-1 rounded uppercase ${isBuffer ? 'bg-amber-950 text-amber-300' : 'bg-emerald-950 text-emerald-300'}">
                ${st.zone}
              </span>
            </div>
            <div class="font-semibold text-slate-100">${st.name}</div>
            <div class="text-[10px] text-slate-400 font-mono">GPS: ${st.latitude.toFixed(4)}° N, ${st.longitude.toFixed(4)}° E</div>
            <div class="pt-1 border-t border-[#232834] flex items-center justify-between text-[10px] text-slate-300 font-mono">
              <span>Status: <strong class="text-emerald-400">${st.status || 'Active'}</strong></span>
              <span>Batt: <strong>${st.battery_level || 95}%</strong></span>
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

    // 2. Individual Tiger Detection Markers (🐅 Icon)
    const allPlotDetections: DetectionResult[] = [...detections];
    if (allPlotDetections.length === 0 && tracks.length > 0) {
      tracks.forEach((tr) => {
        tr.points?.forEach((pt) => {
          allPlotDetections.push({
            id: pt.sighting_id,
            image_id: pt.image_id,
            image_filename: pt.camera_code ? `${pt.camera_code}_capture.jpg` : 'capture.jpg',
            animal: 'Tiger',
            tiger_id: tr.tiger_code || tr.tiger_id,
            confidence: pt.confidence || 0.95,
            confidence_pct: pt.confidence_pct || '95%',
            latitude: pt.latitude,
            longitude: pt.longitude,
            camera_id: pt.camera_code,
            timestamp: pt.captured_at,
            timestamp_formatted: pt.timestamp_formatted,
            thumbnail_url: pt.thumbnail_url,
            image_url: pt.image_url,
            behavior: pt.behavior,
          } as any);
        });
      });
    }

    if (showDetections && allPlotDetections.length > 0) {
      allPlotDetections.forEach((d, idx) => {
        if (d.latitude == null || d.longitude == null) return;
        if (selectedFilterTiger !== 'all' && d.tiger_id !== selectedFilterTiger && (d as any).tiger_code !== selectedFilterTiger) return;

        const el = document.createElement('div');
        el.className = 'cursor-pointer group';

        const isTiger = d.animal?.toLowerCase() === 'tiger';
        const isDeer = d.animal?.toLowerCase().includes('deer') || d.animal?.toLowerCase().includes('muntjac') || d.animal?.toLowerCase().includes('sambar');
        const isCat = d.animal?.toLowerCase().includes('cat') || d.animal?.toLowerCase().includes('bobcat');
        const isLeopard = d.animal?.toLowerCase().includes('leopard');
        const isHuman = d.animal?.toLowerCase().includes('human');
        const isBlank = d.animal?.toLowerCase().includes('blank');

        const iconChar = isTiger ? '🐅' : isDeer ? '🦌' : isCat ? '🐱' : isLeopard ? '🐆' : isHuman ? '👤' : isBlank ? '🍃' : '🐾';
        const borderCls = isTiger ? 'border-amber-500' : isDeer ? 'border-orange-500' : isCat ? 'border-teal-500' : isLeopard ? 'border-yellow-500' : isHuman ? 'border-rose-500' : 'border-emerald-500';

        el.innerHTML = `
          <div class="w-8 h-8 rounded-full bg-[#141820] border-2 ${borderCls} flex items-center justify-center shadow-2xl transition-transform transform group-hover:scale-125">
            <span class="text-sm">${iconChar}</span>
          </div>
          <div class="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.2 rounded bg-black/90 text-[9px] font-mono ${isTiger ? 'text-amber-300 border-amber-800/80' : 'text-slate-200 border-slate-700'} border font-bold">
            ${isTiger ? (d.tiger_id && d.tiger_id !== '-' ? d.tiger_id : 'Tiger') : d.animal}
          </div>
        `;

        const resolvedThumb = resolveMediaUrl(d.thumbnail_url || d.image_url);
        const popupContent = `
          <div class="p-2.5 text-xs space-y-2 min-w-[220px]">
            <div class="flex items-center justify-between border-b border-[#2a3140] pb-1 font-mono">
              <span class="font-bold ${isTiger ? 'text-amber-400' : 'text-slate-100'} text-[13px] flex items-center gap-1">${iconChar} ${isTiger ? (d.tiger_id && d.tiger_id !== '-' ? d.tiger_id : 'Tiger') : d.animal}</span>
              <span class="text-emerald-400 font-semibold">${d.confidence_pct || Math.round((d.confidence || 0.9) * 100) + '%'}</span>
            </div>
            ${resolvedThumb ? `
              <div class="w-full h-24 rounded bg-black overflow-hidden border border-[#2e3544]">
                <img src="${resolvedThumb}" alt="${d.image_filename}" class="w-full h-full object-cover" />
              </div>
            ` : ''}
            <div class="space-y-0.5 text-[11px]">
              <div class="text-slate-200"><strong>Image:</strong> <span class="font-mono text-slate-300">${d.image_filename}</span></div>
              <div class="text-slate-200"><strong>Camera:</strong> <span class="font-mono text-emerald-300">${d.camera_id}</span></div>
              <div class="text-slate-200"><strong>Time:</strong> <span class="font-mono text-slate-300">${d.timestamp_formatted || d.timestamp}</span></div>
              <div class="text-slate-400 font-mono text-[10px]">${d.latitude.toFixed(4)}° N, ${d.longitude.toFixed(4)}° E</div>
              ${d.behavior && d.behavior !== '-' ? `<div class="text-slate-300 text-[10px]"><strong>Behavior:</strong> ${d.behavior}</div>` : ''}
            </div>
            ${d.image_id ? `
              <button 
                onclick="window.dispatchEvent(new CustomEvent('inspect_image', { detail: '${d.image_id}' }))"
                class="w-full mt-1 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-[10px] font-medium flex items-center justify-center gap-1 transition"
              >
                Inspect Capture
              </button>
            ` : ''}
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 14, className: 'dark-popup' }).setHTML(popupContent);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([d.longitude, d.latitude])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    }

    // 3. Alerts Markers (⚠️ Alert Pin)
    if (showAlerts && alerts.length > 0) {
      alerts.filter((a) => a.status === 'active').forEach((al) => {
        const st = stations.find((s) => s.code === al.station_code);
        if (!st || st.latitude == null || st.longitude == null) return;

        const el = document.createElement('div');
        el.className = 'cursor-pointer z-30 group';
        const isCrit = al.severity === 'CRITICAL';
        const bg = isCrit ? 'bg-rose-600' : 'bg-amber-600';

        el.innerHTML = `
          <div class="w-6 h-6 rounded ${bg} text-white font-bold text-xs flex items-center justify-center border border-white shadow-xl animate-pulse">
            ⚠️
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 12, className: 'dark-popup' }).setHTML(`
          <div class="p-2 text-xs max-w-xs space-y-1">
            <div class="font-bold font-mono text-[10px] ${isCrit ? 'text-rose-400' : 'text-amber-400'}">${al.severity} MOVEMENT ALERT</div>
            <div class="font-bold text-slate-100">${al.callsign} (${al.tiger_code})</div>
            <div class="text-slate-300 text-[11px]">${al.explanation?.what_changed || 'Boundary deviation detected'}</div>
          </div>
        `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([st.longitude, st.latitude])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    }
  }, [
    stations, detections, alerts, showStations, showDetections,
    showAlerts, selectedFilterTiger, onSelectStation, onSelectTiger
  ]);

  // Global listener for inspect_image custom event
  useEffect(() => {
    const handleInspect = (e: any) => {
      if (e.detail && onInspectImage) {
        onInspectImage(e.detail);
      }
    };
    window.addEventListener('inspect_image', handleInspect);
    return () => window.removeEventListener('inspect_image', handleInspect);
  }, [onInspectImage]);

  // Get unique tiger codes for filter
  const uniqueTigers = Array.from(
    new Set([
      ...tigers.map((t) => t.tiger_code),
      ...detections.filter((d) => d.tiger_id && d.tiger_id !== '-').map((d) => d.tiger_id),
      ...tracks.map((t) => t.tiger_code)
    ])
  );

  return (
    <div className="relative w-full h-full bg-[#07100a] flex flex-col">
      {/* Top Floating Toolbar */}
      <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1.5 bg-[#0c1a11]/95 p-1.5 rounded border border-[#1c3525] shadow-xl text-xs backdrop-blur-sm">
        <div className="flex items-center gap-1 text-emerald-200 font-medium px-1.5 border-r border-[#1c3525]">
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <span>Layers</span>
        </div>

        <button
          onClick={() => setShowStations(!showStations)}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition flex items-center gap-1 ${
            showStations ? 'bg-[#122417] text-emerald-200 border border-[#1c3525]' : 'bg-[#07100a] text-slate-500'
          }`}
        >
          <span>📷 Cameras</span>
          <span className="font-mono text-[9px] text-emerald-400">({stations.length})</span>
        </button>

        <button
          onClick={() => setShowDetections(!showDetections)}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition flex items-center gap-1 ${
            showDetections ? 'bg-[#2a2416] text-amber-300 border border-[#44381e]' : 'bg-[#07100a] text-slate-500'
          }`}
        >
          <span>🐅 Detections</span>
          <span className="font-mono text-[9px] text-amber-400">({detections.length || tigers.length})</span>
        </button>

        <button
          onClick={() => setShowPaths(!showPaths)}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition flex items-center gap-1 ${
            showPaths ? 'bg-[#1e293b] text-sky-300 border border-[#334155]' : 'bg-[#07100a] text-slate-500'
          }`}
        >
          <span>━━ Paths</span>
        </button>

        <button
          onClick={() => setShowRanges(!showRanges)}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition flex items-center gap-1 ${
            showRanges ? 'bg-[#2e1065] text-purple-300 border border-[#4c1d95]' : 'bg-[#07100a] text-slate-500'
          }`}
        >
          <span>⭕ Ranges</span>
        </button>

        <button
          onClick={() => setShowAlerts(!showAlerts)}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
            showAlerts ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-[#07100a] text-slate-500'
          }`}
        >
          Alerts
        </button>

        {/* Basemap Switcher */}
        <div className="flex items-center gap-1 bg-[#07100a] p-0.5 rounded border border-[#1c3525] text-[10px] font-mono">
          <button
            onClick={() => setBasemapType('osm')}
            className={`px-2 py-0.5 rounded transition ${
              basemapType === 'osm' ? 'bg-emerald-800 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            OSM
          </button>
          <button
            onClick={() => setBasemapType('topo')}
            className={`px-2 py-0.5 rounded transition ${
              basemapType === 'topo' ? 'bg-emerald-800 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Topo
          </button>
          <button
            onClick={() => setBasemapType('satellite')}
            className={`px-2 py-0.5 rounded transition ${
              basemapType === 'satellite' ? 'bg-emerald-800 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Satellite
          </button>
        </div>

        {/* Tiger Selector Filter */}
        {uniqueTigers.length > 0 && (
          <div className="pl-1 border-l border-[#1c3525]">
            <select
              value={selectedFilterTiger}
              onChange={(e) => setSelectedFilterTiger(e.target.value)}
              className="bg-[#07100a] border border-[#1c3525] text-amber-300 text-[11px] rounded px-1.5 py-0.5 focus:outline-none font-mono"
            >
              <option value="all">All Tigers ({uniqueTigers.length})</option>
              {uniqueTigers.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full flex-1" />

      {/* Bottom Map Legend */}
      <div className="absolute bottom-3 left-3 z-20 bg-[#0c1a11]/95 px-3 py-2 rounded border border-[#1c3525] shadow-2xl flex flex-wrap items-center gap-4 text-[11px] text-slate-200 backdrop-blur-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">🐅</span>
          <span className="font-medium text-amber-300">Tiger Detection</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm">📷</span>
          <span className="font-medium text-emerald-300">Camera Station</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sky-400 font-bold font-mono">━━</span>
          <span className="font-medium text-sky-300">Tiger Movement Path</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-purple-400 font-bold font-mono">⭕</span>
          <span className="font-medium text-purple-300">Tiger Observed Range</span>
        </div>
        <div className="flex items-center gap-1.5 pl-2 border-l border-[#1c3525]">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span className="text-[10px] text-slate-400">Core</span>
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ml-1"></span>
          <span className="text-[10px] text-slate-400">Buffer</span>
        </div>
      </div>
    </div>
  );
};
