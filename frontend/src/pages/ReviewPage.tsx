import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api/client';
import { ReviewTask } from '../types';
import { 
  CheckSquare, ShieldAlert, Sparkles, Check, X, PlusCircle, 
  HelpCircle, Eye, AlertCircle, FileText, ChevronRight
} from 'lucide-react';

export const ReviewPage: React.FC = () => {
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [newTigerCode, setNewTigerCode] = useState('');
  const [newCallsign, setNewCallsign] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadTasks = async () => {
    try {
      const data = await ApiClient.getReviewTasks('pending');
      setTasks(data);
      if (data.length > 0 && !selectedTask) {
        loadTaskDetail(data[0].id);
      }
    } catch (_) {} finally {
      setIsLoading(false);
    }
  };

  const loadTaskDetail = async (taskId: string) => {
    try {
      const detail = await ApiClient.getReviewTaskDetail(taskId);
      setSelectedTask(detail);
      setSelectedCandidateId(detail.candidates?.[0]?.tiger_id || null);
      setReviewNotes('');
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

      // Reload tasks
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

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <CheckSquare className="w-6 h-6 text-emerald-400" />
            <span>Human Review Studio</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Resolve ambiguous AI flank stripe identifications, verify provisional individuals, and audit triage decisions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-amber-950/80 text-amber-300 border border-amber-600/40">
            {tasks.length} Decisions Pending
          </span>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl text-center text-slate-400 space-y-2">
          <Sparkles className="w-10 h-10 text-emerald-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-200">All Reviews Completed</h3>
          <p className="text-xs">There are no pending ambiguous identifications or unconfirmed individuals in the queue.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Col: Pending Tasks Queue */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Pending Queue ({tasks.length})
            </h3>
            <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
              {tasks.map((t) => {
                const isSelected = selectedTask?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => loadTaskDetail(t.id)}
                    className={`p-3 rounded-xl border transition cursor-pointer space-y-2 ${
                      isSelected
                        ? 'bg-slate-900 border-emerald-500/60 shadow-md'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200 truncate">{t.image?.filename}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        t.priority === 'high' ? 'bg-rose-900/80 text-rose-300' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {t.priority}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>{t.image?.station_code || 'ST-01'}</span>
                      <span>{t.task_type.replace(/_/g, ' ')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right 3 Cols: Dual Side-by-Side Comparator Studio */}
          {selectedTask && (
            <div className="lg:col-span-3 space-y-6">
              <div className="glass-panel p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                      Flank Stripe Side-by-Side Comparison
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400">
                    Station: <strong className="text-slate-200">{selectedTask.image?.station_code}</strong> • Capture: {selectedTask.image?.captured_at?.replace('T', ' ').slice(0, 19)}
                  </span>
                </div>

                {/* Side-by-Side Display */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Box: New Capture */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
                        Target Camera Trap Capture
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                        Flank: {selectedTask.image?.flank_side || 'Left'}
                      </span>
                    </div>
                    <div className="h-56 rounded-lg overflow-hidden bg-slate-900 border border-slate-800 relative">
                      <img
                        src={selectedTask.image?.image_url}
                        alt="target capture"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>File: {selectedTask.image?.filename}</span>
                      <span>Zone: {selectedTask.image?.zone || 'Core'}</span>
                    </div>
                  </div>

                  {/* Right Box: Top Candidate Reference Profiles */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">
                        Catalogue Candidate Matches
                      </span>
                      <span className="text-[10px] text-slate-400">Select to Confirm</span>
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {selectedTask.candidates?.map((c: any) => {
                        const isChosen = selectedCandidateId === c.tiger_id;
                        const matchPct = Math.round((c.similarity_score || c.similarity || 0.75) * 100);
                        return (
                          <div
                            key={c.tiger_id}
                            onClick={() => setSelectedCandidateId(c.tiger_id)}
                            className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                              isChosen
                                ? 'bg-amber-950/40 border-amber-500/80 shadow-md'
                                : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-lg bg-slate-950 overflow-hidden border border-slate-800">
                                {c.reference_images?.[0] ? (
                                  <img src={c.reference_images[0].thumbnail_url} alt="ref" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs">🐅</div>
                                )}
                              </div>
                              <div>
                                <div className="text-xs font-bold text-slate-100">{c.callsign}</div>
                                <div className="text-[11px] text-slate-400 font-mono">{c.tiger_code} • {c.sex || 'Adult'}</div>
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-xs font-bold text-emerald-400">{matchPct}% Match</div>
                              <span className="text-[10px] text-slate-400">Cosine Score</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Human Biologist Review Decision Controls */}
                <div className="pt-4 border-t border-slate-800 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Reviewer Justification & Audit Notes</span>
                    </label>
                    <input
                      type="text"
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="e.g., Confirmed left flank double stripe bifurcation matches T-048 reference profile."
                      className="w-full bg-slate-950 border border-slate-700 text-slate-100 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSubmitDecision('confirm_candidate')}
                        disabled={isSubmitting || !selectedCandidateId}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-950"
                      >
                        <Check className="w-4 h-4" />
                        <span>Confirm Selected Match</span>
                      </button>

                      <button
                        onClick={() => handleSubmitDecision('create_new_tiger')}
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold rounded-xl transition flex items-center gap-2 border border-slate-700"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span>Enroll as New Individual</span>
                      </button>
                    </div>

                    <button
                      onClick={() => handleSubmitDecision('reject_candidate')}
                      disabled={isSubmitting}
                      className="px-3.5 py-2 bg-slate-950 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 text-xs font-medium rounded-xl transition flex items-center gap-1.5 border border-slate-800"
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
