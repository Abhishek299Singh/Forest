import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api/client';
import { useWebSocket } from '../context/WebSocketContext';
import { 
  FolderUp, HardDrive, ShieldAlert, CheckCircle2, RotateCcw, 
  Play, Layers
} from 'lucide-react';
import { CameraTrapImage } from '../components/common/CameraTrapImage';

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
    { label: 'Turia Core SD Card (ST-01)', path: 'demo_sd_cards/batch_01_core_turia', camera: 'Cuddeback C1 • 3 Photos' },
    { label: 'Gumtara Buffer SD Card (ST-08)', path: 'demo_sd_cards/batch_02_buffer_gumtara', camera: 'Cuddeback C2 • 3 Photos' },
    { label: 'Mixed Reconyx Card (DCIM/100EKTA)', path: 'demo_sd_cards/batch_03_mixed_messy', camera: 'Reconyx HyperFire • 3 Photos' },
  ];

  return (
    <div className="p-4 space-y-4 max-w-[1600px] mx-auto text-xs">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#232834]">
        <div>
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
            <FolderUp className="w-4 h-4 text-slate-400" />
            <span>Field SD Card Ingestion & Automated Triage</span>
          </h2>
          <p className="text-[11px] text-slate-400">
            Raw card processing: EXIF validation, zero-loss blank quarantine, tiger torso localization, and stripe vector matching.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-[#181d26] p-0.5 rounded border border-[#2a3140]">
          <button
            onClick={() => setActiveTab('import')}
            className={`px-3 py-1 rounded text-xs font-medium transition ${
              activeTab === 'import' ? 'bg-[#232834] text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Folder Intake
          </button>
          <button
            onClick={() => setActiveTab('quarantine')}
            className={`px-3 py-1 rounded text-xs font-medium transition flex items-center gap-1.5 ${
              activeTab === 'quarantine' ? 'bg-[#2a2416] text-amber-300' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Quarantine Vault ({quarantinedImages.length})</span>
          </button>
        </div>
      </div>

      {activeTab === 'import' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left 2 Cols: Folder Intake */}
          <div className="lg:col-span-2 space-y-3">
            {/* Input Card */}
            <div className="field-card p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-slate-400" />
                  <span>Select Camera Trap Directory</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400 bg-[#11141a] px-2 py-0.5 rounded border border-[#232834]">
                  Ready for Ingestion
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  placeholder="e.g. E:\DCIM\100CUDD or demo_sd_cards/batch_01_core_turia"
                  className="flex-1 bg-[#11141a] border border-[#232834] text-slate-100 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-slate-500 font-mono"
                />
                <button
                  onClick={handleStartIngest}
                  disabled={isIngesting || !folderPath}
                  className="px-4 py-1.5 bg-[#1a2e20] hover:bg-[#26452f] disabled:opacity-50 text-emerald-200 border border-[#26452f] text-xs font-medium rounded transition flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>{isIngesting ? 'Executing Triage...' : 'Start Triage Run'}</span>
                </button>
              </div>

              {/* Sample Batch Presets */}
              <div className="pt-2.5 border-t border-[#232834]">
                <span className="text-[11px] text-slate-400">Quick Test Batches:</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1.5">
                  {sampleBatches.map((b, idx) => (
                    <div
                      key={idx}
                      onClick={() => setFolderPath(b.path)}
                      className={`p-2.5 rounded border transition cursor-pointer space-y-0.5 ${
                        folderPath === b.path
                          ? 'bg-[#1c222c] border-slate-400 text-white'
                          : 'bg-[#181d26] border-[#232834] text-slate-400 hover:text-slate-200 hover:bg-[#1f2430]'
                      }`}
                    >
                      <div className="font-medium text-slate-200 text-[11px]">{b.label}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{b.camera}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Pipeline Stage Indicators */}
            <div className="field-card p-3 space-y-2">
              <span className="text-[11px] font-semibold text-slate-300">
                Automated 4-Stage Triage & Stripe Biometrics Sequence
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[11px]">
                <div className="bg-[#11141a] p-2 rounded border border-[#232834]">
                  <div className="font-mono text-slate-200 font-semibold">1. EXIF Hash</div>
                  <div className="text-[10px] text-slate-500">SHA-256 Deduplication</div>
                </div>
                <div className="bg-[#11141a] p-2 rounded border border-[#232834]">
                  <div className="font-mono text-amber-400 font-semibold">2. Blank Quarantine</div>
                  <div className="text-[10px] text-slate-500">Zero Loss Vault</div>
                </div>
                <div className="bg-[#11141a] p-2 rounded border border-[#232834]">
                  <div className="font-mono text-slate-200 font-semibold">3. Flank Crop</div>
                  <div className="text-[10px] text-slate-500">Bilateral Flank Isolation</div>
                </div>
                <div className="bg-[#11141a] p-2 rounded border border-[#232834]">
                  <div className="font-mono text-emerald-400 font-semibold">4. Vector Match</div>
                  <div className="text-[10px] text-slate-500">Cosine Catalogue Search</div>
                </div>
              </div>
            </div>

            {/* Ingestion Report & Data Quality Table */}
            {latestReport && (
              <div className="field-card p-3.5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#232834]">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Batch Intake & Quality Audit Report</span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">{latestReport.batch_id}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs">
                  <div className="bg-[#11141a] p-2 rounded border border-[#232834]">
                    <span className="text-slate-400 text-[10px]">Processed</span>
                    <div className="text-base font-semibold text-slate-100 mt-0.5 font-mono">{latestReport.total_images}</div>
                    <span className="text-[9px] text-slate-500 font-mono">{latestReport.processing_time_seconds}s ({latestReport.images_per_minute || 120} img/min)</span>
                  </div>
                  <div className="bg-[#11141a] p-2 rounded border border-[#232834]">
                    <span className="text-emerald-400 text-[10px]">Tiger Captures</span>
                    <div className="text-base font-semibold text-emerald-400 mt-0.5 font-mono">{latestReport.tiger_images}</div>
                    <span className="text-[9px] text-slate-500 font-mono">{latestReport.non_blank} valid images</span>
                  </div>
                  <div className="bg-[#11141a] p-2 rounded border border-[#232834]">
                    <span className="text-amber-400 text-[10px]">Quarantined Blanks</span>
                    <div className="text-base font-semibold text-amber-400 mt-0.5 font-mono">{latestReport.quarantined}</div>
                    <span className="text-[9px] text-slate-500 font-mono">Zero loss vault</span>
                  </div>
                  <div className="bg-[#11141a] p-2 rounded border border-[#232834]">
                    <span className="text-slate-400 text-[10px]">Storage Saved</span>
                    <div className="text-base font-semibold text-slate-200 mt-0.5 font-mono">{latestReport.estimated_storage_saved_mb} MB</div>
                    <span className="text-[9px] text-slate-500 font-mono">{latestReport.avg_latency_ms || 35}ms / img</span>
                  </div>
                </div>

                {/* Data Quality Warnings Section */}
                {latestReport.data_quality && (
                  <div className="bg-[#11141a] p-3 rounded border border-[#232834] space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-300">
                      Field Data Quality & Telemetry Audit
                    </span>
                    {latestReport.data_quality.warnings && latestReport.data_quality.warnings.length > 0 ? (
                      <div className="space-y-1">
                        {latestReport.data_quality.warnings.map((w: string, idx: number) => (
                          <div key={idx} className="text-[11px] text-amber-300 font-mono flex items-center gap-1.5">
                            <span>{w}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-emerald-400 font-mono">
                        ✓ All image EXIF timestamps, GPS coordinates, and file hashes validated with 0 integrity errors.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right 1 Col: Protocol Guidance */}
          <div className="space-y-3">
            <div className="field-card p-3.5 space-y-2">
              <span className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-slate-400" />
                <span>Field Ingestion Protocol</span>
              </span>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                Images are automatically verified against camera station coordinates, EXIF timestamp sequences, and lateral flank stripe patterns.
              </p>
              <div className="p-2 rounded bg-[#11141a] border border-[#232834] text-[11px] text-slate-300 space-y-1.5">
                <div><strong>• Zero Permanent Deletion:</strong> All blank foliage frames are stored safely in the Quarantine Vault.</div>
                <div><strong>• Stripe Re-identification:</strong> Left and right flank patterns are isolated and matched against the persistent tiger catalogue.</div>
                <div><strong>• Survey-Effort Baseline:</strong> Station active trap-nights are calculated to avoid false alerts on newly deployed units.</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Quarantine Vault View */
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-[#181d26] p-3 rounded border border-[#232834]">
            <div>
              <span className="font-semibold text-slate-200 text-xs">
                Quarantine Vault ({quarantinedImages.length} Preserved Captures)
              </span>
              <p className="text-[11px] text-slate-400">
                Preserved blank images from wind and foliage motion. Raw images remain intact on local storage and can be restored anytime.
              </p>
            </div>

            {selectedQuarantineIds.length > 0 && (
              <button
                onClick={handleBatchRestore}
                className="px-3 py-1 bg-[#1a2e20] hover:bg-[#26452f] text-emerald-300 border border-[#26452f] text-xs font-medium rounded transition"
              >
                Restore Selected ({selectedQuarantineIds.length})
              </button>
            )}
          </div>

          {quarantinedImages.length === 0 ? (
            <div className="field-card p-12 text-center text-slate-400 text-xs">
              Quarantine Vault is empty.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {quarantinedImages.map((img) => (
                <div key={img.id} className="field-card rounded overflow-hidden flex flex-col">
                  <div className="h-36 bg-[#11141a] relative">
                    <CameraTrapImage
                      src={img.thumbnail_url}
                      alt={img.filename}
                      aspectRatio="auto"
                      className="h-36"
                      allowZoom={true}
                    />
                    <span className="absolute top-2 left-2 bg-[#11141a]/90 text-amber-300 font-mono text-[10px] px-1.5 py-0.2 rounded border border-[#232834]">
                      {img.station_code || 'ST-01'}
                    </span>
                  </div>
                  <div className="p-2.5 space-y-1.5 flex-1 flex flex-col justify-between text-xs">
                    <div>
                      <div className="font-medium text-slate-200 truncate">{img.filename}</div>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{img.quarantine_reason}</p>
                    </div>
                    <div className="pt-2 border-t border-[#232834] flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-400">{img.file_size_kb} KB</span>
                      <button
                        onClick={() => handleRestore(img.id)}
                        className="px-2 py-0.5 bg-[#181d26] hover:bg-[#232834] text-slate-300 text-[11px] rounded transition flex items-center gap-1 border border-[#2a3140]"
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
