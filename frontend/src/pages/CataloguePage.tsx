import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api/client';
import { TigerSummary, TigerDetail } from '../types';
import { CameraTrapImage } from '../components/common/CameraTrapImage';
import { Cat, Search, X, Edit3, Save, MapPin } from 'lucide-react';

export const CataloguePage: React.FC = () => {
  const [tigers, setTigers] = useState<TigerSummary[]>([]);
  const [selectedTiger, setSelectedTiger] = useState<TigerDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [isEditing, setIsEditing] = useState(false);
  const [editNotes, setEditNotes] = useState('');

  const loadTigers = async () => {
    try {
      const data = await ApiClient.getTigers({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        zone: zoneFilter !== 'all' ? zoneFilter : undefined,
        source: sourceFilter !== 'all' ? sourceFilter : undefined,
        search: searchQuery || undefined,
      });
      setTigers(data);
    } catch (_) {}
  };

  useEffect(() => {
    loadTigers();
  }, [statusFilter, zoneFilter, sourceFilter, searchQuery]);

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
            Persistent photographic profiles and bilateral flank stripe biometric records for Pench Tiger Reserve.
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
              className="bg-[#181d26] border border-[#2a3140] text-slate-100 rounded pl-8 pr-2.5 py-1 text-xs focus:outline-none focus:border-slate-500 w-44 font-sans"
            />
          </div>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="bg-[#181d26] border border-[#2a3140] text-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-slate-500 font-medium"
          >
            <option value="all">All Tiger Profiles</option>
            <option value="pench">Pench Resident Tigers</option>
            <option value="reference">Amur/ATRW Reference Gallery</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#181d26] border border-[#2a3140] text-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-slate-500"
          >
            <option value="all">All Statuses</option>
            <option value="resident">Resident</option>
            <option value="transient">Transient</option>
            <option value="reference">Reference</option>
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

      {/* Main Grid: Tigers Table */}
      <div className="field-card overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#181d26] text-slate-400 text-[11px] border-b border-[#232834]">
            <tr>
              <th className="p-2.5 font-medium w-20">Flank Photo</th>
              <th className="p-2.5 font-medium">Tiger Code</th>
              <th className="p-2.5 font-medium">Callsign / Identity</th>
              <th className="p-2.5 font-medium">Provenance / Source</th>
              <th className="p-2.5 font-medium">Sex / Age</th>
              <th className="p-2.5 font-medium">Primary Zone</th>
              <th className="p-2.5 font-medium">Home Range</th>
              <th className="p-2.5 font-medium">Sightings</th>
              <th className="p-2.5 font-medium">Status</th>
              <th className="p-2.5 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#232834] text-slate-300">
            {tigers.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-400">
                  No individual tiger profiles found matching criteria.
                </td>
              </tr>
            ) : (
              tigers.map((t) => {
                const isRef = t.is_reference || t.source_type === 'amur_atrw' || t.dataset_source?.includes('Reference');
                return (
                  <tr 
                    key={t.id} 
                    onClick={() => handleSelectTiger(t.id)}
                    className="hover:bg-[#181d26] cursor-pointer transition"
                  >
                    <td className="p-2">
                      <div className="w-14 h-9 rounded overflow-hidden bg-black border border-[#2e3544]">
                        <CameraTrapImage
                          src={t.reference_crop || t.reference_thumbnail}
                          alt={t.tiger_code}
                          aspectRatio="video"
                        />
                      </div>
                    </td>
                    <td className="p-2.5 font-mono font-semibold text-slate-100">{t.tiger_code}</td>
                    <td className="p-2.5 font-medium text-slate-200">{t.callsign}</td>
                    <td className="p-2.5">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                        isRef ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-800' : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                      }`}>
                        {isRef ? 'Amur/ATRW Reference' : 'Pench Resident'}
                      </span>
                    </td>
                    <td className="p-2.5">{t.sex} • {t.age_class}</td>
                    <td className="p-2.5">{t.primary_zone}</td>
                    <td className="p-2.5 font-mono tabular-nums">
                      {t.territory_area_km2 > 0 ? `${t.territory_area_km2} km²` : isRef ? 'N/A (Reference)' : 'Provisional'}
                    </td>
                    <td className="p-2.5 font-mono tabular-nums">{t.sightings_count} captures</td>
                    <td className="p-2.5">
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-medium ${
                        t.status === 'resident' ? 'bg-[#1a2e20] text-emerald-300 border border-[#26452f]' :
                        t.status === 'reference' ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' :
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
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Selected Tiger Profile Dossier Modal */}
      {selectedTiger && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#141820] border border-[#2e3544] rounded max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl text-xs overflow-hidden">
            {/* Modal Header */}
            <div className="p-3 bg-[#181d26] border-b border-[#232834] flex items-center justify-between">
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
                  {selectedTiger.sex} • {selectedTiger.age_class} • Primary Range: {selectedTiger.primary_zone} • Confidence: {Math.round(selectedTiger.confidence * 100)}%
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
              {/* Primary Profile Image & Identification Highlights */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[#11141a] p-3 rounded border border-[#232834]">
                <div className="md:col-span-1 rounded overflow-hidden">
                  <CameraTrapImage
                    src={selectedTiger.gallery?.[0]?.crop_url || selectedTiger.reference_thumbnail}
                    alt={selectedTiger.callsign}
                    aspectRatio="video"
                    allowZoom={true}
                    caption={`Primary Reference Capture (${selectedTiger.gallery?.[0]?.flank_side || 'Left'} Flank)`}
                  />
                </div>
                <div className="md:col-span-2 space-y-2 text-xs">
                  <div className="font-semibold text-slate-200 border-b border-[#232834] pb-1">
                    Spatial Identification & Territory Summary
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400">Territory Area (MCP 95%):</span>
                      <div className="font-mono text-slate-200 font-medium">
                        {selectedTiger.territory_area_km2 > 0 ? `${selectedTiger.territory_area_km2} km²` : 'Insufficient captures (<5)'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Territory Centroid:</span>
                      <div className="font-mono text-slate-200 font-medium">
                        {selectedTiger.centroid && selectedTiger.centroid.lat != null && selectedTiger.centroid.lon != null
                          ? `${Number(selectedTiger.centroid.lat).toFixed(4)}° N, ${Number(selectedTiger.centroid.lon).toFixed(4)}° E`
                          : 'Calculating...'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">First Detection:</span>
                      <div className="font-mono text-slate-200">
                        {selectedTiger.first_seen ? selectedTiger.first_seen.split('T')[0] : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Last Verified Detection:</span>
                      <div className="font-mono text-slate-200">
                        {selectedTiger.last_seen ? selectedTiger.last_seen.split('T')[0] : 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Flank Stripe Reference Profiles Gallery */}
              <div className="space-y-1.5">
                <span className="font-semibold text-slate-200 text-xs">
                  Flank Stripe Reference Profiles (Bilateral Symmetry Records)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {selectedTiger.gallery.length === 0 ? (
                    <div className="col-span-4 p-4 text-center text-slate-400 bg-[#11141a] rounded border border-[#232834]">
                      No flank crop profiles enrolled yet.
                    </div>
                  ) : (
                    selectedTiger.gallery.map((g) => (
                      <div key={g.id} className="bg-[#181d26] p-2 rounded border border-[#232834] space-y-1">
                        <div className="rounded overflow-hidden">
                          <CameraTrapImage
                            src={g.crop_url || g.thumbnail_url}
                            alt={`${selectedTiger.callsign} - ${g.flank_side} flank`}
                            aspectRatio="video"
                            allowZoom={true}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="capitalize text-slate-200">{g.flank_side} Flank</span>
                          <span className="text-emerald-400">{Math.round(g.quality_score * 100)}% quality</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Sighting Timeline Table with Real Thumbnails */}
              <div className="space-y-1.5">
                <span className="font-semibold text-slate-200 text-xs">
                  Historical Detection Timeline ({selectedTiger.sightings_timeline.length} Photographic Captures)
                </span>
                <div className="bg-[#181d26] rounded border border-[#232834] overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#11141a] text-slate-400 text-[11px] border-b border-[#232834]">
                      <tr>
                        <th className="p-2 font-medium w-16">Capture</th>
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
                          <td className="p-1.5">
                            <div className="w-12 h-8 rounded overflow-hidden">
                              <CameraTrapImage
                                src={s.thumbnail_url}
                                alt={s.station_code}
                                aspectRatio="video"
                                allowZoom={true}
                              />
                            </div>
                          </td>
                          <td className="p-2 font-medium text-slate-200">{s.station_code} ({s.station_name})</td>
                          <td className="p-2 capitalize">{s.zone}</td>
                          <td className="p-2 font-mono text-[11px] text-slate-400">
                            {s.latitude != null && s.longitude != null
                              ? `${Number(s.latitude).toFixed(4)}, ${Number(s.longitude).toFixed(4)}`
                              : 'GPS Unavailable'}
                          </td>
                          <td className="p-2 font-mono text-slate-300">{s.captured_at ? s.captured_at.replace('T', ' ').slice(0, 19) : 'N/A'}</td>
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
