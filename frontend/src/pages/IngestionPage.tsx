import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api/client';
import { useWebSocket } from '../context/WebSocketContext';
import { 
  FolderUp, HardDrive, ShieldAlert, CheckCircle2, RotateCcw, 
  Play, Eye, Layers, FileCode
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
      await ApiClient.batchQuarantineAction(selectedQuarantineIds, 'restore', 'Restored by Field Biologist');
      setSelectedQuarantineIds([]);
      await loadQuarantine();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const sampleBatches = [
    { label: 'Turia Core SD Card (ST-01)', path: 'demo_sd_cards/batch_01_core_turia' },
    { label: 'Gumtara Buffer SD Card (ST-08)', path: 'demo_sd_cards/batch_02_buffer_gumtara' },
    { label: 'Mixed Reconyx Card (DCIM/100EKTA)', path: 'demo_sd_cards/batch_03_mixed_messy' },
  ];

  return (
    <div className="p-5 space-y-5 max-w-[1500px] mx-auto">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#233044]">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <FolderUp className="w-5 h-5 text-emerald-400" />
            <span>Field SD Card Ingestion & Blank Triage</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Process camera trap memory cards, extract metadata, isolate flank stripes, and preserve blanks in Quarantine.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-[#0b111e] p-1 rounded border border-[#233044]">
          <button
            onClick={() => setActiveTab('import')}
            className={`px-3 py-1 rounded text-xs font-semibold transition ${
              activeTab === 'import' ? 'bg-[#1b3d2b] text-emerald-300 border border-[#2d6144]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Folder Intake
          </button>
          <button
            onClick={() => setActiveTab('quarantine')}
            className={`px-3 py-1 rounded text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === 'quarantine' ? 'bg-[#3d2c12] text-amber-300 border border-[#61471b]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Quarantine Vault ({quarantinedImages.length})</span>
          </button>
        </div>
      </div>

      {activeTab === 'import' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left 2 Cols: Folder Intake & Execution */}
          <div className="lg:col-span-2 space-y-5">
            {/* Input Card */}
            <div className="field-card p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <span>Specify SD Card Root Directory or Folder Path</span>
              </h3>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  placeholder="e.g. E:\DCIM\100CUDD or demo_sd_cards/batch_01_core_turia"
                  className="flex-1 bg-[#0b111e] border border-[#233044] text-slate-100 rounded px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 font-mono"
                />
                <button
                  onClick={handleStartIngest}
                  disabled={isIngesting || !folderPath}
                  className="px-4 py-2 bg-[#1b3d2b] hover:bg-[#234e37] disabled:opacity-50 text-emerald-200 border border-[#2d6144] text-xs font-semibold rounded transition flex items-center justify-center gap-2"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{isIngesting ? 'Processing Intake...' : 'Run Triage Engine'}</span>
                </button>
              </div>

              {/* Sample Card Shortcuts */}
              <div className="pt-2 border-t border-[#1a2537]">
                <span className="text-[11px] text-slate-400 font-medium">Quick Intake Test Sets:</span>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {sampleBatches.map((b, idx) => (
                    <button
                      key={idx}
                      onClick={() => setFolderPath(b.path)}
                      className={`text-xs px-2.5 py-1 rounded border transition ${
                        folderPath === b.path
                          ? 'bg-[#1b3d2b] border-[#2d6144] text-emerald-300'
                          : 'bg-[#0b111e] border-[#233044] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Ingestion Progress */}
            {isIngesting && liveProgress && (
              <div className="field-card p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                  <span className="flex items-center gap-2">
                    <span className="animate-spin h-3.5 w-3.5 border-2 border-emerald-500 border-t-transparent rounded-full"></span>
                    Executing Multi-Tier Computer Vision Triage...
                  </span>
                  <span className="text-emerald-400 font-mono">{liveProgress.processed} / {liveProgress.total} ({liveProgress.progress_pct}%)</span>
                </div>
                <div className="w-full h-2 bg-[#0b111e] rounded-full overflow-hidden border border-[#233044]">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-200"
                    style={{ width: `${liveProgress.progress_pct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Ingestion Report Table */}
            {latestReport && (
              <div className="field-card p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#233044]">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200 uppercase tracking-wide">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Intake Verification Report</span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">{latestReport.batch_id}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs">
                  <div className="bg-[#0b111e] p-2.5 rounded border border-[#233044]">
                    <span className="text-slate-400 text-[11px]">Processed</span>
                    <div className="text-base font-bold text-slate-100 mt-0.5">{latestReport.total_images}</div>
                  </div>
                  <div className="bg-[#0b111e] p-2.5 rounded border border-[#233044]">
                    <span className="text-amber-400 text-[11px]">Tiger Captures</span>
                    <div className="text-base font-bold text-amber-400 mt-0.5">{latestReport.tiger_images}</div>
                  </div>
                  <div className="bg-[#0b111e] p-2.5 rounded border border-[#233044]">
                    <span className="text-slate-400 text-[11px]">Quarantined Blanks</span>
                    <div className="text-base font-bold text-slate-300 mt-0.5">{latestReport.quarantined}</div>
                  </div>
                  <div className="bg-[#0b111e] p-2.5 rounded border border-[#233044]">
                    <span className="text-emerald-400 text-[11px]">Storage Saved</span>
                    <div className="text-base font-bold text-emerald-400 mt-0.5">{latestReport.estimated_storage_saved_mb} MB</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right 1 Col: Protocol Details */}
          <div className="space-y-4 text-xs">
            <div className="field-card p-4 space-y-2.5">
              <h4 className="font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>NTCA Camera Trap Protocol</span>
              </h4>
              <p className="text-slate-300 leading-relaxed">
                Images are automatically verified against camera station coordinates, EXIF timestamp sequences, and lateral flank stripe patterns.
              </p>
              <div className="p-2 rounded bg-[#0b111e] border border-[#233044] text-[11px] text-slate-400 space-y-1">
                <div>• Zero deletion: All blank images preserved in Quarantine.</div>
                <div>• Stripe re-identification: Left & right flank profiles matched.</div>
                <div>• Survey effort: Normalized against active trap-night matrix.</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Quarantine Vault View */
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-[#111827] p-3.5 rounded border border-[#233044]">
            <div>
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                Quarantine Vault ({quarantinedImages.length} Preserved Captures)
              </h3>
              <p className="text-[11px] text-slate-400">Classified as blank vegetation. Images are preserved on disk and can be restored anytime.</p>
            </div>

            {selectedQuarantineIds.length > 0 && (
              <button
                onClick={handleBatchRestore}
                className="px-3 py-1.5 bg-[#1b3d2b] hover:bg-[#234e37] text-emerald-300 border border-[#2d6144] text-xs font-semibold rounded transition"
              >
                Restore Selected ({selectedQuarantineIds.length})
              </button>
            )}
          </div>

          {quarantinedImages.length === 0 ? (
            <div className="field-card p-8 text-center text-slate-400 text-xs">
              Quarantine Vault is empty.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {quarantinedImages.map((img) => (
                <div key={img.id} className="field-card rounded overflow-hidden flex flex-col">
                  <div className="h-36 bg-[#0b111e] relative">
                    <img src={img.thumbnail_url} alt={img.filename} className="w-full h-full object-cover" />
                    <span className="absolute top-2 left-2 bg-[#0b111e]/90 text-amber-300 font-mono text-[10px] font-bold px-1.5 py-0.2 rounded border border-[#233044]">
                      {img.station_code || 'ST-01'}
                    </span>
                  </div>
                  <div className="p-2.5 space-y-1.5 flex-1 flex flex-col justify-between text-xs">
                    <div>
                      <div className="font-medium text-slate-200 truncate">{img.filename}</div>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{img.quarantine_reason}</p>
                    </div>
                    <div className="pt-2 border-t border-[#1a2537] flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-400">{img.file_size_kb} KB</span>
                      <button
                        onClick={() => handleRestore(img.id)}
                        className="px-2 py-1 bg-[#1e293b] hover:bg-[#1b3d2b] hover:text-emerald-300 text-slate-300 text-[11px] rounded transition flex items-center gap-1 border border-[#233044]"
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
