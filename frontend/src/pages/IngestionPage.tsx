import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api/client';
import { useWebSocket } from '../context/WebSocketContext';
import { 
  FolderUp, HardDrive, ShieldAlert, CheckCircle2, RotateCcw, 
  Trash2, AlertTriangle, Layers, Play, CheckSquare, Eye, Clock
} from 'lucide-react';

export const IngestionPage: React.FC = () => {
  const [folderPath, setFolderPath] = useState('demo_sd_cards/batch_01_core_turia');
  const [isIngesting, setIsIngesting] = useState(false);
  const [liveProgress, setLiveProgress] = useState<any>(null);
  const [latestReport, setLatestReport] = useState<any>(null);
  const [quarantinedImages, setQuarantinedImages] = useState<any[]>([]);
  const [selectedQuarantineIds, setSelectedQuarantineIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'import' | 'quarantine'>('import');
  const { subscribe } = useWebSocket();

  const loadQuarantine = async () => {
    try {
      const res = await ApiClient.getQuarantined(50, 0);
      setQuarantinedImages(res.items || []);
    } catch (_) {}
  };

  useEffect(() => {
    loadQuarantine();

    const unsubProgress = subscribe('ingestion_progress', (data) => {
      setLiveProgress(data);
    });

    const unsubComplete = subscribe('ingestion_completed', (data) => {
      setLatestReport(data);
      setIsIngesting(false);
      loadQuarantine();
    });

    return () => {
      unsubProgress();
      unsubComplete();
    };
  }, [subscribe]);

  const handleStartIngest = async () => {
    if (!folderPath) return;
    setIsIngesting(true);
    setLiveProgress({ processed: 0, total: 100, progress_pct: 0 });
    setLatestReport(null);

    try {
      const report = await ApiClient.ingestFolder(folderPath);
      setLatestReport(report);
      loadQuarantine();
    } catch (err: any) {
      alert(`Ingestion error: ${err.message}`);
    } finally {
      setIsIngesting(false);
    }
  };

  const handleRestore = async (imageId: string) => {
    try {
      await ApiClient.restoreQuarantine(imageId);
      await loadQuarantine();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBatchRestore = async () => {
    if (selectedQuarantineIds.length === 0) return;
    try {
      await ApiClient.batchQuarantineAction(selectedQuarantineIds, 'restore', 'Restored by Field Officer');
      setSelectedQuarantineIds([]);
      await loadQuarantine();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const sampleBatches = [
    { label: 'Batch 1: Turia Core SD Card (ST-01)', path: 'demo_sd_cards/batch_01_core_turia' },
    { label: 'Batch 2: Gumtara Buffer Mixed Card (ST-08)', path: 'demo_sd_cards/batch_02_buffer_gumtara' },
    { label: 'Batch 3: Messy Reconyx Card (DCIM/100EKTA)', path: 'demo_sd_cards/batch_03_mixed_messy' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Title & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <FolderUp className="w-6 h-6 text-emerald-400" />
            <span>Camera Trap Image Triage & Ingestion</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Batch-process raw camera-trap SD cards, filter blanks into safe quarantine, and identify individual tigers.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('import')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'import' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Folder Ingestion
          </button>
          <button
            onClick={() => setActiveTab('quarantine')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === 'quarantine' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Quarantine Vault ({quarantinedImages.length})</span>
          </button>
        </div>
      </div>

      {activeTab === 'import' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Ingestion Controls & Progress */}
          <div className="lg:col-span-2 space-y-6">
            {/* Folder Select Box */}
            <div className="glass-panel p-6 rounded-2xl space-y-4">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wide flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <span>Select Camera Trap Folder / SD Card Directory</span>
              </h3>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  placeholder="e.g., E:\DCIM\100CUDD or demo_sd_cards/batch_01_core_turia"
                  className="flex-1 bg-slate-950 border border-slate-700 text-slate-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 font-mono"
                />
                <button
                  onClick={handleStartIngest}
                  disabled={isIngesting || !folderPath}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{isIngesting ? 'Triaging...' : 'Start Triage Run'}</span>
                </button>
              </div>

              {/* Sample SD Card Batches Shortcut */}
              <div className="pt-2 border-t border-slate-800">
                <span className="text-xs text-slate-400 font-medium">Quick Select Sample SD Cards:</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {sampleBatches.map((b, idx) => (
                    <button
                      key={idx}
                      onClick={() => setFolderPath(b.path)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                        folderPath === b.path
                          ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Ingestion Live Progress Bar */}
            {isIngesting && liveProgress && (
              <div className="glass-panel p-5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                  <span className="flex items-center gap-2">
                    <span className="animate-spin h-3.5 w-3.5 border-2 border-emerald-500 border-t-transparent rounded-full"></span>
                    Running Multi-Stage AI Triage Pipeline...
                  </span>
                  <span className="text-emerald-400">{liveProgress.processed} / {liveProgress.total} Images ({liveProgress.progress_pct}%)</span>
                </div>
                <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-forest-400 transition-all duration-300"
                    style={{ width: `${liveProgress.progress_pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>🐅 Tigers: <strong className="text-amber-400">{liveProgress.tiger_images}</strong></span>
                  <span>🌿 Quarantined Blanks: <strong className="text-slate-300">{liveProgress.quarantined}</strong></span>
                </div>
              </div>
            )}

            {/* Ingestion Report Table */}
            {latestReport && (
              <div className="glass-panel p-6 rounded-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                      Batch Ingestion Summary Report
                    </h3>
                  </div>
                  <span className="font-mono text-xs text-slate-400">{latestReport.batch_id}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                    <span className="text-xs text-slate-400">Total Processed</span>
                    <div className="text-lg font-bold text-slate-100">{latestReport.total_images}</div>
                  </div>
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                    <span className="text-xs text-amber-400">Tiger Captures</span>
                    <div className="text-lg font-bold text-amber-400">{latestReport.tiger_images}</div>
                  </div>
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                    <span className="text-xs text-slate-400">Quarantined Blanks</span>
                    <div className="text-lg font-bold text-slate-300">{latestReport.quarantined}</div>
                  </div>
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                    <span className="text-xs text-emerald-400">Storage Saved</span>
                    <div className="text-lg font-bold text-emerald-400">{latestReport.estimated_storage_saved_mb} MB</div>
                  </div>
                </div>

                <div className="text-xs text-slate-400 pt-2 flex items-center justify-between">
                  <span>⏱️ Processing Time: {latestReport.processing_time_seconds}s</span>
                  <span>🔒 Blanks are safely preserved in Quarantine Vault</span>
                </div>
              </div>
            )}
          </div>

          {/* Right 1 Col: Triage Rules & Policy Documentation */}
          <div className="space-y-4">
            <div className="glass-panel p-5 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Automated Triage Protocol</span>
              </h4>
              <ul className="space-y-2.5 text-xs text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0"></span>
                  <span><strong>Zero Permanent Deletion:</strong> Blank foliage photos are moved to the Quarantine Vault and can be restored at any time.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0"></span>
                  <span><strong>Flank Stripe Analysis:</strong> Identifies left/right lateral flank patterns and vector-matches against persistent catalogue.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0"></span>
                  <span><strong>Human Review Dispatch:</strong> Matches with similarity between 50% and 85% are automatically routed to the Review Studio.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0"></span>
                  <span><strong>Human Privacy Filter:</strong> Human photos are blurred and restricted to authorized Forest Officers.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        /* Quarantine Vault View */
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900 p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="text-sm font-bold text-slate-100">Quarantine Vault ({quarantinedImages.length} Preserved Images)</h3>
                <p className="text-xs text-slate-400">Photos classified as blank foliage. Original files remain untouched on disk.</p>
              </div>
            </div>

            {selectedQuarantineIds.length > 0 && (
              <button
                onClick={handleBatchRestore}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore Selected ({selectedQuarantineIds.length})</span>
              </button>
            )}
          </div>

          {quarantinedImages.length === 0 ? (
            <div className="glass-panel p-12 rounded-2xl text-center text-slate-400 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <p className="text-sm font-medium text-slate-300">Quarantine Vault is empty.</p>
              <p className="text-xs">All processed captures have either been classified into animals or restored.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {quarantinedImages.map((img) => (
                <div
                  key={img.id}
                  className="glass-panel rounded-xl overflow-hidden border border-slate-800 hover:border-slate-700 transition flex flex-col"
                >
                  <div className="relative h-40 bg-slate-950">
                    <img
                      src={img.thumbnail_url}
                      alt={img.filename}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2 bg-slate-900/90 text-amber-300 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-700">
                      {img.station_code || 'ST-01'}
                    </div>
                  </div>

                  <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-200 truncate">{img.filename}</div>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{img.quarantine_reason}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">{img.file_size_kb} KB</span>
                      <button
                        onClick={() => handleRestore(img.id)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 text-xs rounded-lg transition flex items-center gap-1 border border-slate-700"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restore</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
