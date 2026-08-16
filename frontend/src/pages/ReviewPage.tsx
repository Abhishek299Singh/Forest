import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api/client';
import { ReviewTask } from '../types';
import { CameraTrapImage } from '../components/common/CameraTrapImage';
import { CheckSquare, Check, X, PlusCircle, Trees, ZoomIn, ZoomOut } from 'lucide-react';

export const ReviewPage: React.FC = () => {
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [newTigerCode, setNewTigerCode] = useState('');
  const [newCallsign, setNewCallsign] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stripeFilter, setStripeFilter] = useState<'normal' | 'contrast' | 'grayscale' | 'invert'>('normal');
  const [zoomLevel, setZoomLevel] = useState(1);

  const loadTasks = async () => {
    try {
      const data = await ApiClient.getReviewTasks('pending');
      setTasks(data);
      if (data.length > 0 && !selectedTask) {
        loadTaskDetail(data[0].id);
      }
    } catch (_) {}
  };

  const loadTaskDetail = async (taskId: string) => {
    try {
      const detail = await ApiClient.getReviewTaskDetail(taskId);
      setSelectedTask(detail);
      setSelectedCandidateId(detail.candidates?.[0]?.tiger_id || null);
      setReviewNotes('');
      setZoomLevel(1);
    } catch (_) {}
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleSubmitDecision = async (action: string) => {
    if (!selectedTask) return;
    setIsSubmitting(true);
    try {
      await ApiClient.submitReviewDecision({
        task_id: selectedTask.id,
        action_taken: action,
        selected_tiger_id: selectedCandidateId || undefined,
        new_tiger_code: newTigerCode || undefined,
        new_callsign: newCallsign || undefined,
        notes: reviewNotes,
      });

      const remaining = tasks.filter(t => t.id !== selectedTask.id);
      setTasks(remaining);
      if (remaining.length > 0) {
        loadTaskDetail(remaining[0].id);
      } else {
        setSelectedTask(null);
      }
    } catch (err: any) {
      alert(`Decision error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getImageStyle = () => {
    let filterStyle = '';
    switch (stripeFilter) {
      case 'contrast': filterStyle = 'contrast(180%) brightness(95%)'; break;
      case 'grayscale': filterStyle = 'grayscale(100%) contrast(150%)'; break;
      case 'invert': filterStyle = 'invert(100%) contrast(150%)'; break;
      default: filterStyle = 'none';
    }
    return {
      filter: filterStyle,
      transform: `scale(${zoomLevel})`,
      transformOrigin: 'center center',
      transition: 'transform 0.12s ease-out, filter 0.12s ease-out'
    };
  };

  return (
    <div className="p-4 space-y-4 max-w-[1600px] mx-auto text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#232834]">
        <div>
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
            <CheckSquare className="w-4 h-4 text-slate-400" />
            <span>Biologist Review Studio — Ambiguous Stripe Identification</span>
          </h2>
          <p className="text-[11px] text-slate-400">
            Manual verification queue for camera captures requiring expert review and bilateral flank validation.
          </p>
        </div>
        <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-[#2a2416] text-amber-300 border border-[#44381e]">
          {tasks.length} Pending Review Tasks
        </span>
      </div>

      {tasks.length === 0 ? (
        <div className="field-card p-12 text-center text-slate-400 text-xs space-y-2">
          <Trees className="w-8 h-8 text-emerald-400 mx-auto" />
          <p className="font-semibold text-slate-200 text-sm">Review Queue Clear</p>
          <p>No ambiguous identifications or unassigned tiger captures pending review.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Left 1 Col: Task Queue */}
          <div className="space-y-2">
            <span className="font-semibold text-slate-300 text-xs uppercase tracking-wider text-[11px]">
              Review Queue ({tasks.length})
            </span>
            <div className="space-y-1.5 max-h-[700px] overflow-y-auto pr-1">
              {tasks.map((t) => {
                const isSelected = selectedTask?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => loadTaskDetail(t.id)}
                    className={`p-2.5 rounded border transition cursor-pointer space-y-1.5 ${
                      isSelected
                        ? 'bg-[#1c222c] border-slate-400'
                        : 'bg-[#141820] border-[#232834] hover:bg-[#181d26]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-8 rounded overflow-hidden shrink-0">
                        <CameraTrapImage
                          src={t.image?.thumbnail_url}
                          alt={t.image?.filename || 'task'}
                          aspectRatio="video"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-200 truncate text-[11px]">{t.image?.filename}</span>
                          <span className={`text-[9px] font-mono px-1 py-0.2 rounded font-medium ${
                            t.priority === 'high' ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-[#181d26] text-slate-400 border border-[#232834]'
                          }`}>
                            {t.priority.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {t.image?.station_code || 'ST-01'} • {t.image?.captured_at?.split('T')[0] || '2026-08-16'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right 3 Cols: Comparative Workstation */}
          {selectedTask && (
            <div className="lg:col-span-3 space-y-3">
              <div className="field-card p-4 space-y-3">
                {/* Station & Tool Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#232834]">
                  <div>
                    <span className="font-semibold text-slate-200">Capture: {selectedTask.image?.filename}</span>
                    <span className="text-slate-400 ml-2">Station: <strong className="text-slate-300">{selectedTask.image?.station_code} ({selectedTask.image?.station_name})</strong></span>
                  </div>

                  {/* Contrast Filter Tools & Zoom */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-[#11141a] p-0.5 rounded border border-[#232834] text-[11px]">
                      <button
                        onClick={() => setZoomLevel(Math.max(0.8, zoomLevel - 0.2))}
                        className="p-1 text-slate-400 hover:text-white"
                        title="Zoom Out"
                      >
                        <ZoomOut className="w-3 h-3" />
                      </button>
                      <span className="text-[10px] font-mono text-slate-400 px-1">{Math.round(zoomLevel * 100)}%</span>
                      <button
                        onClick={() => setZoomLevel(Math.min(2.5, zoomLevel + 0.2))}
                        className="p-1 text-slate-400 hover:text-white"
                        title="Zoom In"
                      >
                        <ZoomIn className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex items-center gap-0.5 bg-[#11141a] p-0.5 rounded border border-[#232834] text-[11px]">
                      {(['normal', 'contrast', 'grayscale', 'invert'] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setStripeFilter(f)}
                          className={`px-2 py-0.5 rounded capitalize transition text-[11px] ${
                            stripeFilter === f ? 'bg-[#1e2430] text-white font-medium' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Side-by-Side Images */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left: Query Capture */}
                  <div className="bg-[#11141a] p-3 rounded border border-[#232834] space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-200">Query Field Capture</span>
                      <span className="text-slate-400 text-[10px] font-mono capitalize">Flank: {selectedTask.image?.flank_side || 'Left'}</span>
                    </div>
                    <div className="h-60 rounded bg-[#181d26] border border-[#232834] overflow-hidden flex items-center justify-center relative">
                      {selectedTask.image?.image_url ? (
                        <img
                          src={selectedTask.image?.image_url}
                          alt="target"
                          style={getImageStyle()}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-slate-500 font-mono text-xs">Image unavailable</span>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between">
                      <span>{selectedTask.image?.captured_at?.replace('T', ' ').slice(0, 19) || 'N/A'}</span>
                      <span>Zone: {selectedTask.image?.zone || 'Core'}</span>
                    </div>
                  </div>

                  {/* Right: Candidate Matches */}
                  <div className="bg-[#11141a] p-3 rounded border border-[#232834] space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-200">Candidate Profiles (Top Matches)</span>
                      <span className="text-slate-400 text-[10px]">Select Profile to Confirm</span>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {selectedTask.candidates?.map((c: any) => {
                        const isChosen = selectedCandidateId === c.tiger_id;
                        const matchPct = Math.round((c.similarity_score || c.similarity || 0.75) * 100);
                        const refPhoto = c.reference_images?.[0]?.thumbnail_url || c.reference_images?.[0]?.crop_url;
                        return (
                          <div
                            key={c.tiger_id}
                            onClick={() => setSelectedCandidateId(c.tiger_id)}
                            className={`p-2 rounded border transition cursor-pointer flex items-center justify-between ${
                              isChosen
                                ? 'bg-[#1c222c] border-emerald-500'
                                : 'bg-[#181d26] border-[#232834] hover:bg-[#1f2430]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-14 h-10 rounded bg-[#11141a] overflow-hidden border border-[#232834] shrink-0">
                                <CameraTrapImage
                                  src={refPhoto}
                                  alt={c.callsign}
                                  aspectRatio="video"
                                />
                              </div>
                              <div className="text-xs">
                                <div className="font-semibold text-slate-200">{c.callsign}</div>
                                <div className="text-[10px] font-mono text-slate-400">{c.tiger_code} • {c.sex || 'Adult'}</div>
                              </div>
                            </div>

                            <div className="text-right font-mono">
                              <div className="text-xs font-semibold text-emerald-400">{matchPct}% match</div>
                              <span className="text-[9px] text-slate-500 uppercase">Cosine Sim</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Reviewer Action Bar */}
                <div className="pt-3 border-t border-[#232834] space-y-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-300">
                      Biologist Rationale Notes (Recorded in Audit Ledger)
                    </label>
                    <input
                      type="text"
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="e.g. Dorsal flank bifurcations match PTR-T-048 reference profile."
                      className="w-full bg-[#11141a] border border-[#232834] text-slate-200 rounded px-3 py-1 text-xs focus:outline-none focus:border-slate-500 font-sans"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSubmitDecision('confirm_candidate')}
                        disabled={isSubmitting || !selectedCandidateId}
                        className="px-3.5 py-1.5 bg-[#1a2e20] hover:bg-[#26452f] disabled:opacity-50 text-emerald-300 border border-[#26452f] text-xs font-medium rounded transition flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Confirm Selected Match</span>
                      </button>

                      <button
                        onClick={() => handleSubmitDecision('create_new_tiger')}
                        disabled={isSubmitting}
                        className="px-3.5 py-1.5 bg-[#2a2416] hover:bg-[#3d331e] text-amber-300 border border-[#44381e] text-xs font-medium rounded transition flex items-center gap-1.5"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Enroll New Individual</span>
                      </button>
                    </div>

                    <button
                      onClick={() => handleSubmitDecision('reject_candidate')}
                      disabled={isSubmitting}
                      className="px-3 py-1.5 bg-[#181d26] hover:bg-rose-950 text-slate-400 hover:text-rose-300 text-xs rounded transition flex items-center gap-1 border border-[#232834]"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject / Mark Uncertain</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
