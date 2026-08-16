import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api/client';
import { TigerSummary, TigerDetail } from '../types';
import { Cat, Search, ChevronRight, X, Edit3, Save } from 'lucide-react';

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
    <div className="p-4 space-y-4 max-w-[1600px] mx-auto text-xs">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-[#232834]">
        <div>
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
            <Cat className="w-4 h-4 text-slate-400" />
            <span>Individual Tiger Registry & Flank Stripe Catalogue</span>
          </h2>
          <p className="text-[11px] text-slate-400">
            Persistent photographic profiles of resident and transient tigers in Pench Tiger Reserve.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Search code or callsign..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#181d26] border border-[#2a3140] text-slate-100 rounded pl-8 pr-2.5 py-1 text-xs focus:outline-none focus:border-slate-500 w-48 font-sans"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#181d26] border border-[#2a3140] text-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-slate-500"
          >
            <option value="all">All Statuses</option>
            <option value="resident">Resident</option>
            <option value="transient">Transient</option>
            <option value="provisional">Provisional</option>
          </select>

          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="bg-[#181d26] border border-[#2a3140] text-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-slate-500"
          >
            <option value="all">All Zones</option>
            <option value="Core">Core Territory</option>
            <option value="Buffer">Buffer Territory</option>
          </select>
        </div>
      </div>

      {/* Main Grid: Tigers Table / Dossier List */}
      <div className="field-card overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#181d26] text-slate-400 text-[11px] border-b border-[#232834]">
            <tr>
              <th className="p-2.5 font-medium">Tiger Code</th>
              <th className="p-2.5 font-medium">Callsign / Identity</th>
              <th className="p-2.5 font-medium">Sex / Age Class</th>
              <th className="p-2.5 font-medium">Primary Zone</th>
              <th className="p-2.5 font-medium">Home Range (MCP 95%)</th>
              <th className="p-2.5 font-medium">Sightings</th>
              <th className="p-2.5 font-medium">Last Detection</th>
              <th className="p-2.5 font-medium">Status</th>
              <th className="p-2.5 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#232834] text-slate-300">
            {tigers.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-400">
                  No individual tiger profiles found matching criteria.
                </td>
              </tr>
            ) : (
              tigers.map((t) => (
                <tr 
                  key={t.id} 
                  onClick={() => handleSelectTiger(t.id)}
                  className="hover:bg-[#181d26] cursor-pointer transition"
                >
                  <td className="p-2.5 font-mono font-semibold text-slate-100">{t.tiger_code}</td>
                  <td className="p-2.5 font-medium text-slate-200">{t.callsign}</td>
                  <td className="p-2.5">{t.sex} • {t.age_class}</td>
                  <td className="p-2.5">{t.primary_zone}</td>
                  <td className="p-2.5 font-mono tabular-nums">
                    {t.territory_area_km2 > 0 ? `${t.territory_area_km2} km²` : 'Provisional'}
                  </td>
                  <td className="p-2.5 font-mono tabular-nums">{t.sightings_count} captures</td>
                  <td className="p-2.5 font-mono text-[11px] text-slate-400">
                    {t.last_seen ? t.last_seen.split('T')[0] : 'N/A'}
                  </td>
                  <td className="p-2.5">
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-medium ${
                      t.status === 'resident' ? 'bg-[#1a2e20] text-emerald-300 border border-[#26452f]' :
                      t.status === 'transient' ? 'bg-[#2a2416] text-amber-300 border border-[#44381e]' :
                      'bg-[#181d26] text-slate-400 border border-[#232834]'
                    }`}>
                      {t.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-2.5 text-right">
                    <button className="text-slate-400 hover:text-white text-[11px]">
                      View Dossier →
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Selected Tiger Profile Dossier Modal */}
      {selectedTiger && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#141820] border border-[#2e3544] rounded max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl text-xs overflow-hidden">
            {/* Modal Header */}
            <div className="p-3.5 bg-[#181d26] border-b border-[#232834] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-100">{selectedTiger.callsign}</h3>
                  <span className="text-xs font-mono text-slate-300 bg-[#11141a] px-1.5 py-0.2 rounded border border-[#232834]">
                    {selectedTiger.tiger_code}
                  </span>
                  {selectedTiger.sightings_timeline.length >= 5 ? (
                    <span className="text-[10px] font-mono text-emerald-400 bg-[#1a2e20] px-1.5 py-0.2 rounded border border-[#26452f]">
                      Verified Range (MCP 95% • {selectedTiger.territory_area_km2} km²)
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-amber-300 bg-[#2a2416] px-1.5 py-0.2 rounded border border-[#44381e]">
                      Provisional Centroid (N = {selectedTiger.sightings_timeline.length} &lt; 5 sightings)
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {selectedTiger.sex} • {selectedTiger.age_class} • Primary Range: {selectedTiger.primary_zone}
                </p>
              </div>

              <button
                onClick={() => setSelectedTiger(null)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {/* Flank Stripe Reference Profiles */}
              <div className="space-y-1.5">
                <span className="font-semibold text-slate-200 text-xs">
                  Flank Stripe Reference Profiles
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {selectedTiger.gallery.map((g) => (
                    <div key={g.id} className="bg-[#181d26] p-2 rounded border border-[#232834] space-y-1">
                      <div className="h-24 rounded bg-[#11141a] overflow-hidden">
                        <img src={g.thumbnail_url} alt="flank" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="capitalize text-slate-200">{g.flank_side} Flank</span>
                        <span className="text-slate-400 font-mono">{Math.round(g.quality_score * 100)}% quality</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sighting Timeline Table */}
              <div className="space-y-1.5">
                <span className="font-semibold text-slate-200 text-xs">
                  Historical Detection Timeline ({selectedTiger.sightings_timeline.length} Captures)
                </span>
                <div className="bg-[#181d26] rounded border border-[#232834] overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#11141a] text-slate-400 text-[11px] border-b border-[#232834]">
                      <tr>
                        <th className="p-2 font-medium">Station Code & Name</th>
                        <th className="p-2 font-medium">Zone</th>
                        <th className="p-2 font-medium">Coordinates</th>
                        <th className="p-2 font-medium">Detection Timestamp</th>
                        <th className="p-2 font-medium">Confidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#232834] text-slate-300">
                      {selectedTiger.sightings_timeline.map((s) => (
                        <tr key={s.id} className="hover:bg-[#1f2430]">
                          <td className="p-2 font-medium text-slate-200">{s.station_code} ({s.station_name})</td>
                          <td className="p-2 capitalize">{s.zone}</td>
                          <td className="p-2 font-mono text-[11px] text-slate-400">{s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}</td>
                          <td className="p-2 font-mono text-slate-300">{s.captured_at.replace('T', ' ').slice(0, 19)}</td>
                          <td className="p-2 font-mono text-emerald-400">{Math.round(s.confidence * 100)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Biologist Notes Field */}
              <div className="space-y-1.5 pt-2 border-t border-[#232834]">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 text-xs">Field Biologist Dossier Notes</span>
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px]"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit Notes</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleSaveNotes}
                      className="px-2.5 py-0.5 bg-[#1a2e20] hover:bg-[#26452f] text-emerald-300 rounded border border-[#26452f] flex items-center gap-1 text-[11px]"
                    >
                      <Save className="w-3 h-3" />
                      <span>Save</span>
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={3}
                    className="w-full bg-[#11141a] border border-[#232834] text-slate-200 rounded p-2 text-xs focus:outline-none focus:border-slate-500 font-sans"
                  />
                ) : (
                  <p className="text-slate-300 bg-[#181d26] p-2.5 rounded border border-[#232834] leading-relaxed text-[11px]">
                    {selectedTiger.notes || 'No specific field notes recorded for this individual.'}
                  </p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-[#181d26] border-t border-[#232834] flex justify-end">
              <button
                onClick={() => setSelectedTiger(null)}
                className="px-3 py-1 bg-[#1e232d] hover:bg-[#282e3c] text-slate-200 rounded border border-[#2e3544] text-xs font-medium"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
