import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api/client';
import { TigerSummary, TigerDetail } from '../types';
import { Cat, Search, ChevronRight, X, Edit3 } from 'lucide-react';

export const CataloguePage: React.FC = () => {
  const [tigers, setTigers] = useState<TigerSummary[]>([]);
  const [selectedTiger, setSelectedTiger] = useState<TigerDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
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
    } catch (_) {}
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
    <div className="p-5 space-y-5 max-w-[1500px] mx-auto">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#1c3525]">
        <div>
          <h2 className="text-base font-semibold text-emerald-100 flex items-center gap-2">
            <Cat className="w-5 h-5 text-amber-500" />
            <span>Persistent Individual Tiger Registry</span>
          </h2>
          <p className="text-xs text-emerald-400/70 mt-0.5">
            Photographic catalogue of resident and transient individuals with bilateral flank stripe profiles and territory estimates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-emerald-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search ID or callsign..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#07100a] border border-[#1c3525] text-emerald-100 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:border-emerald-500 w-48 font-sans"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#07100a] border border-[#1c3525] text-emerald-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Statuses</option>
            <option value="resident">Resident</option>
            <option value="transient">Transient</option>
            <option value="provisional">Provisional</option>
          </select>

          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="bg-[#07100a] border border-[#1c3525] text-emerald-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Zones</option>
            <option value="Core">Core Territory</option>
            <option value="Buffer">Buffer Territory</option>
          </select>
        </div>
      </div>

      {/* Registry Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tigers.map((t) => {
          const isProv = t.status === 'provisional';
          return (
            <div
              key={t.id}
              onClick={() => handleSelectTiger(t.id)}
              className="field-card-interactive rounded overflow-hidden cursor-pointer flex flex-col group"
            >
              {/* Photo Banner */}
              <div className="h-40 bg-[#07100a] relative">
                {t.reference_thumbnail ? (
                  <img src={t.reference_thumbnail} alt={t.callsign} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl">🐅</div>
                )}
                <span className="absolute top-2.5 left-2.5 bg-[#07100a]/90 text-amber-300 font-mono text-xs font-bold px-2 py-0.5 rounded border border-[#1c3525]">
                  {t.tiger_code}
                </span>
                <span className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                  isProv ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                }`}>
                  {t.status}
                </span>
              </div>

              {/* Details */}
              <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between text-xs">
                <div>
                  <h3 className="font-semibold text-emerald-100 text-sm group-hover:text-emerald-400 transition">
                    {t.callsign}
                  </h3>
                  <div className="text-[11px] text-emerald-400/70 mt-0.5">
                    {t.sex} • {t.age_class} • {t.primary_zone}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#122417]">
                  <div className="bg-[#07100a] p-2 rounded border border-[#1c3525]">
                    <span className="text-[10px] text-emerald-400/70">Territory (MCP 95%)</span>
                    <div className="font-bold text-emerald-400 mt-0.5 tabular-nums font-mono">{t.territory_area_km2} km²</div>
                  </div>
                  <div className="bg-[#07100a] p-2 rounded border border-[#1c3525]">
                    <span className="text-[10px] text-emerald-400/70">Total Sightings</span>
                    <div className="font-bold text-emerald-100 mt-0.5 tabular-nums font-mono">{t.sightings_count} captures</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-emerald-400/70 pt-1">
                  <span>Last Seen: {t.last_seen ? t.last_seen.split('T')[0] : 'Recent'}</span>
                  <span className="text-emerald-400 font-medium flex items-center gap-0.5">
                    Dossier <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tiger Dossier Modal */}
      {selectedTiger && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#0e1c12] border border-[#1c3525] rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-[#07100a] border-b border-[#1c3525] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-emerald-100">{selectedTiger.callsign}</h3>
                  <span className="text-xs font-mono text-amber-400 bg-[#122417] px-2 py-0.5 rounded border border-[#1c3525]">
                    {selectedTiger.tiger_code}
                  </span>
                </div>
                <p className="text-xs text-emerald-400/70 mt-0.5">
                  {selectedTiger.sex} • {selectedTiger.age_class} • Range: {selectedTiger.primary_zone} ({selectedTiger.territory_area_km2} km²)
                </p>
              </div>

              <button
                onClick={() => setSelectedTiger(null)}
                className="p-1 rounded text-emerald-400 hover:text-white hover:bg-[#162b1e]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-5 overflow-y-auto text-xs">
              {/* Flank Gallery */}
              <div className="space-y-2">
                <h4 className="font-bold text-emerald-200 uppercase tracking-wider text-[11px]">
                  Flank Stripe Reference Profiles
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {selectedTiger.gallery.map((g) => (
                    <div key={g.id} className="bg-[#07100a] p-2 rounded border border-[#1c3525] space-y-1">
                      <div className="h-24 rounded bg-[#122417] overflow-hidden">
                        <img src={g.thumbnail_url} alt="flank" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="capitalize text-emerald-200">{g.flank_side} Flank</span>
                        <span className="text-emerald-400 font-mono">{Math.round(g.quality_score * 100)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sighting Timeline */}
              <div className="space-y-2">
                <h4 className="font-bold text-emerald-200 uppercase tracking-wider text-[11px]">
                  Historical Camera Trap Sightings ({selectedTiger.sightings_timeline.length})
                </h4>
                <div className="bg-[#07100a] rounded border border-[#1c3525] overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#122417] text-emerald-400 border-b border-[#1c3525]">
                      <tr>
                        <th className="p-2.5">Station</th>
                        <th className="p-2.5">Zone</th>
                        <th className="p-2.5">Coordinates</th>
                        <th className="p-2.5">Captured Timestamp</th>
                        <th className="p-2.5">Confidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#122417] text-emerald-200/90">
                      {selectedTiger.sightings_timeline.map((s) => (
                        <tr key={s.id} className="hover:bg-[#14271a]">
                          <td className="p-2.5 font-semibold text-emerald-100">{s.station_code} ({s.station_name})</td>
                          <td className="p-2.5 capitalize">{s.zone}</td>
                          <td className="p-2.5 font-mono text-[11px] text-emerald-400/80">{s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}</td>
                          <td className="p-2.5 font-mono text-emerald-400/80">{s.captured_at.replace('T', ' ').slice(0, 19)}</td>
                          <td className="p-2.5 text-emerald-400 font-mono">{Math.round(s.confidence * 100)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Field Notes */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-emerald-200 uppercase tracking-wider text-[11px]">
                    Biologist Field Notes
                  </h4>
                  {!isEditing && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                  )}
                </div>
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full bg-[#07100a] border border-[#1c3525] text-emerald-100 rounded p-2 text-xs focus:outline-none focus:border-emerald-500 h-20"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setIsEditing(false)}
                        className="px-2.5 py-1 bg-[#162b1e] text-emerald-300 text-xs rounded"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveNotes}
                        className="px-2.5 py-1 bg-[#162b1e] text-emerald-200 text-xs rounded border border-[#2d523b]"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="bg-[#07100a] p-3 rounded border border-[#1c3525] text-emerald-200/90 leading-relaxed">
                    {selectedTiger.notes || 'No specific field notes recorded.'}
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
