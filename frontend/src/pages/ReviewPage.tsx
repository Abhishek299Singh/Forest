import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api/client';
import { ReviewTask } from '../types';
import { CheckSquare, Check, X, PlusCircle, FileText, Trees, ZoomIn, ZoomOut, Sparkles } from 'lucide-react';

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
      transition: 'transform 0.15s ease-out, filter 0.15s ease-out'
    };
  };

  return (
    <div className="p-4 md:p-5 space-y-4 max-w-[1500px] mx-auto text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1c3525]">
        <div>
          <h2 className="text-base font-semibold text-emerald-100 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-emerald-400" />
            <span>Biologist Comparative Stripe Identification Studio</span>
          </h2>
          <p className="text-xs text-emerald-400/70 mt-0.5">
            Audit ambiguous flank stripe pattern matches (50%–85% confidence), verify bifurcations, and enroll provisional tigers.
          </p>
        </div>
        <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-amber-950/80 text-amber-300 border border-amber-800/60">
          {tasks.length} Pending Tasks in Queue
        </span>
      </div>

      {tasks.length === 0 ? (
        <div className="field-card p-12 text-center text-emerald-400/70 text-xs space-y-2">
          <Trees className="w-8 h-8 text-emerald-400 mx-auto" />
          <p className="font-semibold text-emerald-200 text-sm">All Identification Tasks Reviewed</p>
          <p>No pending ambiguous identifications or unconfirmed captures in queue.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Left 1 Col: Task Queue */}
          <div className="space-y-2 text-xs">
            <h3 className="font-bold text-emerald-300 uppercase tracking-wider text-[11px]">
              Task Queue ({tasks.length})
            </h3>
            <div className="space-y-1.5 max-h-[700px] overflow-y-auto pr-1">
              {tasks.map((t) => {
                const isSelected = selectedTask?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => loadTaskDetail(t.id)}
                    className={`p-2.5 rounded border transition cursor-pointer space-y-1 ${
                      isSelected
                        ? 'bg-[#162b1e] border-emerald-500/70'
                        : 'bg-[#0e1c12] border-[#1c3525] hover:bg-[#14271a]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-emerald-100 truncate">{t.image?.filename}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                        t.priority === 'high' ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-[#122417] text-emerald-300'
                      }`}>
                        {t.priority.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-[10px] text-emerald-400/70 flex items-center justify-between">
                      <span>{t.image?.station_code || 'ST-01'}</span>
                      <span>{t.task_type.replace(/_/g, ' ')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right 3 Cols: Side-by-Side Studio */}
          {selectedTask && (
            <div className="lg:col-span-3 space-y-4">
              <div className="field-card p-4 space-y-4">
                {/* Station & Image Context & Filter Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#1c3525] text-xs">
                  <div>
                    <span className="font-bold text-emerald-100">Capture: {selectedTask.image?.filename}</span>
                    <span className="text-emerald-400/70 ml-2">Station: <strong className="text-emerald-200">{selectedTask.image?.station_code} ({selectedTask.image?.station_name})</strong></span>
                  </div>

                  {/* Contrast Filter Tools & Zoom */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-[#07100a] p-0.5 rounded border border-[#1c3525] text-[11px]">
                      <button
                        onClick={() => setZoomLevel(Math.max(0.8, zoomLevel - 0.2))}
                        className="p-1 text-emerald-400 hover:text-white"
                        title="Zoom Out"
                      >
                        <ZoomOut className="w-3 h-3" />
                      </button>
                      <span className="text-[10px] font-mono text-emerald-400 px-1">{Math.round(zoomLevel * 100)}%</span>
                      <button
                        onClick={() => setZoomLevel(Math.min(2.5, zoomLevel + 0.2))}
                        className="p-1 text-emerald-400 hover:text-white"
                        title="Zoom In"
                      >
                        <ZoomIn className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1 bg-[#07100a] p-0.5 rounded border border-[#1c3525] text-[11px]">
                      {(['normal', 'contrast', 'grayscale', 'invert'] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setStripeFilter(f)}
                          className={`px-2 py-0.5 rounded capitalize transition ${
                            stripeFilter === f ? 'bg-[#162b1e] text-emerald-200 font-semibold' : 'text-emerald-500 hover:text-emerald-200'
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Split Side-by-Side Display */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left: Target Capture */}
                  <div className="bg-[#07100a] p-3 rounded border border-[#1c3525] space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-emerald-400">Target Field Capture</span>
                      <span className="text-emerald-400/70 text-[10px] font-mono capitalize">Flank: {selectedTask.image?.flank_side || 'Left'}</span>
                    </div>
                    <div className="h-56 rounded bg-[#122417] border border-[#1c3525] overflow-hidden flex items-center justify-center">
                      <img
                        src={selectedTask.image?.image_url}
                        alt="target"
                        style={getImageStyle()}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-[10px] font-mono text-emerald-400/70 flex items-center justify-between">
                      <span>{selectedTask.image?.captured_at?.replace('T', ' ').slice(0, 19)}</span>
                      <span>Zone: {selectedTask.image?.zone || 'Core'}</span>
                    </div>
                  </div>

                  {/* Right: Top Candidate Matches */}
                  <div className="bg-[#07100a] p-3 rounded border border-[#1c3525] space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-amber-400">Catalogue Match Candidates</span>
                      <span className="text-emerald-400/70 text-[10px]">Select Reference to Confirm</span>
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {selectedTask.candidates?.map((c: any) => {
                        const isChosen = selectedCandidateId === c.tiger_id;
                        const matchPct = Math.round((c.similarity_score || c.similarity || 0.75) * 100);
                        return (
                          <div
                            key={c.tiger_id}
                            onClick={() => setSelectedCandidateId(c.tiger_id)}
                            className={`p-2 rounded border transition cursor-pointer flex items-center justify-between ${
                              isChosen
                                ? 'bg-[#2c1e15] border-amber-500/70'
                                : 'bg-[#0e1c12] border-[#1c3525] hover:bg-[#14271a]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-12 h-12 rounded bg-[#07100a] overflow-hidden border border-[#1c3525]">
                                {c.reference_images?.[0] ? (
                                  <img 
                                    src={c.reference_images[0].thumbnail_url} 
                                    alt="ref" 
                                    style={getImageStyle()}
                                    className="w-full h-full object-cover" 
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs">🐅</div>
                                )}
                              </div>
                              <div className="text-xs">
                                <div className="font-semibold text-emerald-100">{c.callsign}</div>
                                <div className="text-[10px] font-mono text-emerald-400/70">{c.tiger_code} • {c.sex || 'Adult'}</div>
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-xs font-bold text-emerald-400 font-mono">{matchPct}% Match</div>
                              <span className="text-[9px] text-emerald-500 uppercase font-mono">Cosine Sim</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Decision Actions & Justification */}
                <div className="pt-3 border-t border-[#1c3525] space-y-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Reviewer Biological Rationale (Audited Record)</span>
                    </label>
                    <input
                      type="text"
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="e.g. Verified left flank dorsal stripe fork matches PTR-T-048 reference profile."
                      className="w-full bg-[#07100a] border border-[#1c3525] text-emerald-100 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500 font-sans"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSubmitDecision('confirm_candidate')}
                        disabled={isSubmitting || !selectedCandidateId}
                        className="px-3.5 py-1.5 bg-[#162b1e] hover:bg-[#1f3b2a] disabled:opacity-50 text-emerald-200 border border-[#2d523b] text-xs font-semibold rounded transition flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Confirm Selected Match</span>
                      </button>

                      <button
                        onClick={() => handleSubmitDecision('create_new_tiger')}
                        disabled={isSubmitting}
                        className="px-3.5 py-1.5 bg-[#2c1e15] hover:bg-[#3d2c1e] text-amber-200 border border-[#5e3f2b] text-xs font-semibold rounded transition flex items-center gap-1.5"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Enroll as New Individual</span>
                      </button>
                    </div>

                    <button
                      onClick={() => handleSubmitDecision('reject_candidate')}
                      disabled={isSubmitting}
                      className="px-3 py-1.5 bg-[#07100a] hover:bg-rose-950/60 text-emerald-500 hover:text-rose-300 text-xs rounded transition flex items-center gap-1 border border-[#1c3525]"
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
