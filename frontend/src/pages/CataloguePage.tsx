import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api/client';
import { TigerSummary, TigerDetail } from '../types';
import { 
  Cat, Search, Filter, Calendar, MapPin, Activity, 
  ShieldCheck, ChevronRight, X, Edit3, CheckCircle2, Eye
} from 'lucide-react';

export const CataloguePage: React.FC = () => {
  const [tigers, setTigers] = useState<TigerSummary[]>([]);
  const [selectedTiger, setSelectedTiger] = useState<TigerDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editNotes, setEditNotes] = useState('');

  const loadTigers = async () => {
    try {
      const data = await ApiClient.getTigers({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        zone: zoneFilter !== 'all' ? zoneFilter : undefined,
        search: searchQuery || undefined,
      });
      setTigers(data);
    } catch (_) {} finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTigers();
  }, [statusFilter, zoneFilter, searchQuery]);

  const handleSelectTiger = async (tigerId: string) => {
    try {
      const detail = await ApiClient.getTigerDetail(tigerId);
      setSelectedTiger(detail);
      setEditNotes(detail.notes || '');
      setIsEditing(false);
    } catch (_) {}
  };

  const handleSaveNotes = async () => {
    if (!selectedTiger) return;
    try {
      await ApiClient.updateTiger(selectedTiger.id, { notes: editNotes });
      setSelectedTiger({ ...selectedTiger, notes: editNotes });
      setIsEditing(false);
      loadTigers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <Cat className="w-6 h-6 text-amber-500" />
            <span>Persistent Individual Tiger Catalogue</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Official biometrics, lateral flank stripe patterns, territory home ranges, and historical sightings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search code or callsign..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-emerald-500 w-52"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Statuses</option>
            <option value="resident">Resident</option>
            <option value="transient">Transient</option>
            <option value="provisional">Provisional (New)</option>
          </select>

          {/* Zone Filter */}
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Zones</option>
            <option value="Core">Core Territory</option>
            <option value="Buffer">Buffer Territory</option>
          </select>
        </div>
      </div>

      {/* Tigers Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {tigers.map((t) => {
          const isProv = t.status === 'provisional';
          return (
            <div
              key={t.id}
              onClick={() => handleSelectTiger(t.id)}
              className="glass-panel rounded-2xl overflow-hidden border border-slate-800 hover:border-amber-500/50 transition cursor-pointer flex flex-col group shadow-lg"
            >
              {/* Reference Image Crop */}
              <div className="relative h-44 bg-slate-950">
                {t.reference_thumbnail ? (
                  <img
                    src={t.reference_thumbnail}
                    alt={t.callsign}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">🐅</div>
                )}
                <div className="absolute top-3 left-3 bg-slate-950/80 px-2.5 py-1 rounded-lg text-xs font-bold text-amber-400 border border-slate-700">
                  {t.tiger_code}
                </div>
                <div className={`absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  isProv ? 'bg-amber-950 text-amber-300 border border-amber-600' : 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                }`}>
                  {t.status}
                </div>
              </div>

              {/* Tiger Details */}
              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-100 group-hover:text-amber-400 transition">
                    {t.callsign}
                  </h3>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {t.sex} • {t.age_class} • {t.primary_zone}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800">
                  <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-850">
                    <span className="text-[11px] text-slate-400">Territory Area</span>
                    <div className="font-bold text-emerald-400 mt-0.5">{t.territory_area_km2} km²</div>
                  </div>
                  <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-850">
                    <span className="text-[11px] text-slate-400">Total Sightings</span>
                    <div className="font-bold text-slate-200 mt-0.5">{t.sightings_count} Records</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <span>Last: {t.last_seen ? t.last_seen.split('T')[0] : 'Recent'}</span>
                  <span className="text-amber-400 font-semibold flex items-center gap-1 group-hover:translate-x-1 transition">
                    View Dossier <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tiger Dossier Drawer / Modal */}
      {selectedTiger && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xl">
                  🐅
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-100">{selectedTiger.callsign}</h3>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-mono">
                      {selectedTiger.tiger_code}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {selectedTiger.sex} • {selectedTiger.age_class} • Territory: {selectedTiger.primary_zone} ({selectedTiger.territory_area_km2} km²)
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedTiger(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Flank Stripe Reference Gallery */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                  Flank Stripe Reference Profiles
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {selectedTiger.gallery.map((g) => (
                    <div key={g.id} className="bg-slate-950 p-2 rounded-xl border border-slate-800 space-y-1.5">
                      <div className="h-28 rounded-lg overflow-hidden bg-slate-900">
                        <img src={g.thumbnail_url} alt="flank" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-300 capitalize">{g.flank_side} Flank</span>
                        <span className="text-emerald-400 font-bold">{Math.round(g.quality_score * 100)}% Match</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sighting Timeline Table */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                  Historical Sightings Timeline ({selectedTiger.sightings_timeline.length})
                </h4>
                <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-3">Station</th>
                        <th className="p-3">Zone</th>
                        <th className="p-3">Coordinates</th>
                        <th className="p-3">Timestamp</th>
                        <th className="p-3">Confidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 text-slate-300">
                      {selectedTiger.sightings_timeline.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-900/40">
                          <td className="p-3 font-semibold text-slate-100">{s.station_code} ({s.station_name})</td>
                          <td className="p-3 capitalize">{s.zone}</td>
                          <td className="p-3 font-mono text-[11px] text-slate-400">{s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}</td>
                          <td className="p-3 text-slate-400">{s.captured_at.replace('T', ' ').slice(0, 19)}</td>
                          <td className="p-3 text-emerald-400 font-semibold">{Math.round(s.confidence * 100)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Biologist Field Notes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                    Biologist Field Observations & Notes
                  </h4>
                  {!isEditing && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Notes</span>
                    </button>
                  )}
                </div>
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:border-emerald-500 h-24"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setIsEditing(false)}
                        className="px-3 py-1 bg-slate-800 text-slate-300 text-xs rounded-lg hover:bg-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveNotes}
                        className="px-3 py-1 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-500"
                      >
                        Save Notes
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800">
                    {selectedTiger.notes || 'No specific field observations recorded.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
