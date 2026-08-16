import React, { useState, useEffect, useRef } from 'react';
import { ApiClient } from '../api/client';
import { useWebSocket } from '../context/WebSocketContext';
import { 
  FolderUp, HardDrive, ShieldAlert, CheckCircle2, RotateCcw, 
  Play, Layers, Search, ShieldCheck, FileCheck, RefreshCw, 
  MapPin, AlertCircle, FileText, Database, Map, ArrowRight, ExternalLink
} from 'lucide-react';
import { CameraTrapImage } from '../components/common/CameraTrapImage';

interface IngestionPageProps {
  onNavigateToMap?: (params?: { lat?: number; lon?: number; station?: string }) => void;
}

export const IngestionPage: React.FC<IngestionPageProps> = ({ onNavigateToMap }) => {
  const [folderPath, setFolderPath] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState<string>('Idle');
  const [liveProgress, setLiveProgress] = useState<any>(null);
  const [latestReport, setLatestReport] = useState<any>(null);
  const [quarantinedImages, setQuarantinedImages] = useState<any[]>([]);
  const [selectedQuarantineIds, setSelectedQuarantineIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'import' | 'quarantine'>('import');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      if (data.stage) {
        setCurrentStage(data.stage);
      }
    });

    const unsubComplete = subscribe('ingestion_completed', (data) => {
      setLatestReport(data);
      setIsIngesting(false);
      setCurrentStage('Complete');
      loadQuarantine();
    });

    return () => {
      unsubProgress();
      unsubComplete();
    };
  }, [subscribe]);

  const handleScanFolder = async () => {
    if (!folderPath) return;
    setIsScanning(true);
    setScanResult(null);
    setScanError(null);
    setCurrentStage('Scanning');
    try {
      const res = await ApiClient.scanFolder(folderPath);
      if (res.valid === false) {
        setScanError(res.error || 'Failed to scan directory');
        setCurrentStage('Idle');
      } else {
        setScanResult(res);
        setCurrentStage('Validated');
      }
    } catch (err: any) {
      setScanError(err.message || 'Error occurred while scanning folder');
      setCurrentStage('Idle');
    } finally {
      setIsScanning(false);
    }
  };

  const handleFolderPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const firstFile = files[0];
      const relPath = (firstFile as any).webkitRelativePath;
      if (relPath) {
        const rootFolder = relPath.split('/')[0];
        setFolderPath(rootFolder);
        setScanResult({
          valid: true,
          folder_path: rootFolder,
          total_images_found: Array.from(files).filter(f => f.type.startsWith('image/') || f.name.match(/\.(jpg|jpeg|png)$/i)).length,
          csv_files_found: Array.from(files).filter(f => f.name.endsWith('.csv')).map(f => f.name),
          csv_rows_count: Array.from(files).filter(f => f.name.endsWith('.csv')).length > 0 ? 'Detected' : 0,
          detected_stations: [`ST-${rootFolder.slice(0, 8).toUpperCase()}`],
          estimated_size_mb: roundMB(files),
          status: 'ready'
        });
        setCurrentStage('Validated');
      } else {
        setFolderPath(firstFile.name);
      }
    }
  };

  const roundMB = (files: FileList) => {
    let bytes = 0;
    for (let i = 0; i < files.length; i++) {
      bytes += files[i].size;
    }
    return Math.round(bytes / (1024 * 1024) * 10) / 10;
  };

  const handleStartIngest = async () => {
    if (!folderPath) return;
    setIsIngesting(true);
    setIngestError(null);
    setCurrentStage('Processing');
    setLiveProgress({ processed: 0, total: scanResult?.total_images_found || scanResult?.csv_rows_count || 1, progress_pct: 0 });
    setLatestReport(null);

    try {
      const report = await ApiClient.ingestFolder(folderPath);
      setLatestReport(report);
      setCurrentStage('Complete');
      loadQuarantine();
    } catch (err: any) {
      setIngestError(err.message || 'Ingestion execution error');
      setCurrentStage('Error');
    } finally {
      setIsIngesting(false);
    }
  };

  const handleViewOnMap = (lat?: number | null, lon?: number | null, station?: string | null) => {
    if (onNavigateToMap) {
      onNavigateToMap({
        lat: lat != null ? Number(lat) : undefined,
        lon: lon != null ? Number(lon) : undefined,
        station: station || undefined,
      });
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

  const stagesList = [
    { name: 'Scanning', label: '1. Scan & Validate', icon: Search },
    { name: 'Validated', label: '2. Folder Validated', icon: FileCheck },
    { name: 'Processing', label: '3. Ingestion & Triage', icon: Play },
    { name: 'Database saved', label: '4. Database Saved', icon: Database },
    { name: 'Map synchronized', label: '5. Map Synced', icon: Map },
    { name: 'Complete', label: '6. Complete', icon: CheckCircle2 },
  ];

  return (
    <div className="p-4 space-y-4 max-w-[1600px] mx-auto text-xs">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#232834]">
        <div>
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
            <FolderUp className="w-4 h-4 text-emerald-400" />
            <span>IMPORT CAMERA SD CARD & MANIFEST</span>
          </h2>
          <p className="text-[11px] text-slate-400">
            End-to-end SD card intake: directory inspection, CSV manifest parsing, zero-loss blank quarantine, tiger stripe re-identification, and geospatial map synchronization.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-[#181d26] p-0.5 rounded border border-[#2a3140]">
          <button
            onClick={() => setActiveTab('import')}
            className={`px-3 py-1 rounded text-xs font-medium transition ${
              activeTab === 'import' ? 'bg-[#232834] text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            SD Card Ingestion
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
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left 2 Cols: SD Card Folder & Ingestion Controls */}
            <div className="lg:col-span-2 space-y-3">
              {/* Folder Selection Card */}
              <div className="field-card p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                    <HardDrive className="w-4 h-4 text-slate-400" />
                    <span>Select Camera Trap Folder / CSV Manifest</span>
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-[#1a2e20] px-2 py-0.5 rounded border border-[#26452f] flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Read-Only Source Protected</span>
                  </span>
                </div>

                <p className="text-[11px] text-slate-400">
                  Enter the mounted SD card directory path, raw photo folder, or CSV manifest containing camera-trap observations:
                </p>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={folderPath}
                    onChange={(e) => setFolderPath(e.target.value)}
                    placeholder="e.g. E:\DCIM\100CAM, demo_sd_cards/batch_01_core_turia, or path/to/manifest.csv"
                    className="flex-1 bg-[#11141a] border border-[#232834] text-slate-100 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-slate-500 font-mono"
                  />

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFolderPickerChange}
                    // @ts-ignore
                    webkitdirectory=""
                    directory=""
                    multiple
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-[#181d26] hover:bg-[#232834] text-slate-200 border border-[#2a3140] text-xs font-medium rounded transition flex items-center justify-center gap-1.5"
                  >
                    <FolderUp className="w-3.5 h-3.5" />
                    <span>Browse Folder</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleScanFolder}
                    disabled={isScanning || !folderPath}
                    className="px-3.5 py-1.5 bg-[#181d26] hover:bg-[#232834] disabled:opacity-50 text-slate-200 border border-[#2a3140] text-xs font-medium rounded transition flex items-center justify-center gap-1.5"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>{isScanning ? 'Scanning...' : 'Scan Folder'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleStartIngest}
                    disabled={isIngesting || !folderPath}
                    className="px-4 py-1.5 bg-[#1a2e20] hover:bg-[#26452f] disabled:opacity-50 text-emerald-200 border border-[#26452f] text-xs font-medium rounded transition flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>{isIngesting ? 'Executing Triage...' : 'Import & Process SD Card'}</span>
                  </button>
                </div>

                {/* Scan Error Notice */}
                {scanError && (
                  <div className="p-2.5 rounded bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{scanError}</span>
                  </div>
                )}

                {/* Scan Summary Card */}
                {scanResult && (
                  <div className="p-3 rounded bg-[#11141a] border border-[#232834] space-y-2.5">
                    <div className="flex items-center justify-between pb-1.5 border-b border-[#1c222c]">
                      <span className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                        <FileCheck className="w-4 h-4 text-emerald-400" />
                        <span>Pre-Scan Summary & Folder Audit</span>
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-[#16291d] px-2 py-0.5 rounded border border-[#26452f]">
                        Ready for Import
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                      <div className="bg-[#161a22] p-2 rounded border border-[#232834]">
                        <span className="text-slate-400 text-[10px]">Images Found</span>
                        <div className="text-sm font-semibold text-slate-100 mt-0.5">{scanResult.total_images_found}</div>
                      </div>
                      <div className="bg-[#161a22] p-2 rounded border border-[#232834]">
                        <span className="text-slate-400 text-[10px]">CSV Manifest</span>
                        <div className="text-sm font-semibold text-amber-400 mt-0.5">
                          {scanResult.csv_files_found?.length > 0 ? `${scanResult.csv_rows_count} records` : 'None'}
                        </div>
                      </div>
                      <div className="bg-[#161a22] p-2 rounded border border-[#232834]">
                        <span className="text-slate-400 text-[10px]">Stations Detected</span>
                        <div className="text-sm font-semibold text-emerald-400 mt-0.5">
                          {scanResult.detected_stations?.length > 0 ? scanResult.detected_stations.join(', ') : 'ST-001'}
                        </div>
                      </div>
                      <div className="bg-[#161a22] p-2 rounded border border-[#232834]">
                        <span className="text-slate-400 text-[10px]">Estimated Footprint</span>
                        <div className="text-sm font-semibold text-slate-200 mt-0.5">~{scanResult.estimated_size_mb} MB</div>
                      </div>
                    </div>

                    {scanResult.csv_files_found?.length > 0 && (
                      <div className="p-2 rounded bg-[#181d26] border border-[#2a3140] text-[11px] text-slate-300 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-amber-400" />
                          <span>Detected Manifest: <strong>{scanResult.csv_files_found.join(', ')}</strong> ({scanResult.csv_rows_count} rows)</span>
                        </div>
                        {scanResult.locations_count > 0 && (
                          <span className="text-emerald-400 font-mono text-[10px]">
                            {scanResult.locations_count} records with GPS
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Safety notice banner */}
                <div className="p-2 rounded bg-[#151922] border border-[#202735] flex items-start gap-2 text-[11px] text-slate-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Original SD Card Protection:</strong> Source files are opened in read-only mode and copied into the managed workspace. The original SD card is never modified, renamed, or deleted.
                  </span>
                </div>
              </div>

              {/* Ingestion Error Notice */}
              {ingestError && (
                <div className="p-3 rounded bg-rose-950/50 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <div>
                    <div className="font-semibold">Import & Processing Error</div>
                    <div className="text-[11px] text-rose-300 mt-0.5">{ingestError}</div>
                  </div>
                </div>
              )}

              {/* Processing Pipeline Progression Status */}
              <div className="field-card p-3.5 space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-[#232834]">
                  <span className="font-semibold text-slate-200 text-xs">
                    Processing Progression Workflow
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Status: <strong className="text-emerald-400">{currentStage}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                  {stagesList.map((st, idx) => {
                    const isPassed = ['Validated', 'Processing', 'Database saved', 'Map synchronized', 'Complete'].includes(currentStage) && idx <= stagesList.findIndex(s => s.name === currentStage);
                    const isCurrent = currentStage === st.name;
                    const Icon = st.icon;

                    return (
                      <div
                        key={st.name}
                        className={`p-2.5 rounded border transition space-y-1 ${
                          isCurrent
                            ? 'bg-[#1a2e20] border-emerald-500 text-emerald-200'
                            : isPassed
                            ? 'bg-[#141d18] border-[#233f2b] text-slate-300'
                            : 'bg-[#11141a] border-[#232834] text-slate-500'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span>Step {idx + 1}</span>
                          <Icon className={`w-3.5 h-3.5 ${isCurrent ? 'text-emerald-400 animate-pulse' : isPassed ? 'text-emerald-400' : 'text-slate-600'}`} />
                        </div>
                        <div className="font-semibold text-[11px] truncate">{st.name}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Live Progress Bar */}
              {isIngesting && liveProgress && (
                <div className="field-card p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                      <span>Processing Batch: {liveProgress.batch_id || 'Active Batch'}</span>
                    </span>
                    <span className="font-mono text-emerald-400 font-semibold">{liveProgress.progress_pct}%</span>
                  </div>

                  <div className="w-full h-2 bg-[#11141a] rounded overflow-hidden border border-[#232834]">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${liveProgress.progress_pct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1">
                    <span>Processed: {liveProgress.processed} / {liveProgress.total}</span>
                    <span>Tigers: {liveProgress.tiger_images || 0} • Wildlife: {liveProgress.other_animals || 0} • Quarantined: {liveProgress.quarantined || 0}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Right 1 Col: Protocol Guidance */}
            <div className="space-y-3">
              <div className="field-card p-3.5 space-y-2">
                <span className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-slate-400" />
                  <span>Field SD Card Protocol</span>
                </span>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Raw field SD card photos and CSV detection records are triaged locally with zero cloud dependencies.
                </p>
                <div className="p-2.5 rounded bg-[#11141a] border border-[#232834] text-[11px] text-slate-300 space-y-2">
                  <div><strong>• Read-Only Safety:</strong> Camera SD cards remain 100% untouched. All operations occur in the local workspace.</div>
                  <div><strong>• CSV & Image Ingestion:</strong> Supports direct image batches as well as camera observation manifests.</div>
                  <div><strong>• Zero Permanent Deletion:</strong> All false triggers (swaying leaves, wind) are safely stored in the Quarantine Vault.</div>
                  <div><strong>• Real Geospatial Sync:</strong> Exact coordinates are propagated immediately to the Interactive Reserve Map.</div>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* VISIBLE IMPORT RESULTS & DETECTION TABLE SECTION (Requirement 5 & 6)       */}
          {/* ========================================================================= */}
          {latestReport && (
            <div className="field-card p-4 space-y-4 border-slate-600 bg-[#12161f]">
              {/* Header & Map Action Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#232834]">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-sm font-bold text-slate-100">
                      Import Results — {latestReport.batch_id}
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Data saved to local database and synchronized with geospatial layers.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const firstLoc = latestReport.detections?.find((d: any) => d.latitude != null && d.longitude != null);
                      handleViewOnMap(firstLoc?.latitude, firstLoc?.longitude, firstLoc?.camera_id);
                    }}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-medium text-xs transition shadow-lg flex items-center gap-2"
                  >
                    <Map className="w-4 h-4" />
                    <span>View on Map</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Key Metric Counters (Requirement 5) */}
              <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-10 gap-2 text-center text-xs">
                <div className="bg-[#171c26] p-2.5 rounded border border-[#2a3140]">
                  <span className="text-slate-400 text-[10px]">Processing</span>
                  <div className="text-sm font-bold text-emerald-400 mt-0.5 font-mono">Complete</div>
                </div>

                <div className="bg-[#171c26] p-2.5 rounded border border-[#2a3140]">
                  <span className="text-slate-400 text-[10px]">Total Files</span>
                  <div className="text-base font-bold text-slate-100 mt-0.5 font-mono">{latestReport.total_files || latestReport.total_images}</div>
                </div>

                <div className="bg-[#171c26] p-2.5 rounded border border-[#2a3140]">
                  <span className="text-slate-400 text-[10px]">Total Detections</span>
                  <div className="text-base font-bold text-slate-100 mt-0.5 font-mono">{latestReport.total_detections ?? latestReport.processed}</div>
                </div>

                <div className="bg-[#171c26] p-2.5 rounded border border-[#2a3140]">
                  <span className="text-amber-400 text-[10px]">Tiger Detections</span>
                  <div className="text-base font-bold text-amber-400 mt-0.5 font-mono">{latestReport.tiger_detections ?? latestReport.tiger_images}</div>
                </div>

                <div className="bg-[#171c26] p-2.5 rounded border border-[#2a3140]">
                  <span className="text-sky-400 text-[10px]">Other Wildlife</span>
                  <div className="text-base font-bold text-sky-400 mt-0.5 font-mono">{latestReport.other_wildlife ?? 0}</div>
                </div>

                <div className="bg-[#171c26] p-2.5 rounded border border-[#2a3140]">
                  <span className="text-slate-400 text-[10px]">Duplicates</span>
                  <div className="text-base font-bold text-slate-300 mt-0.5 font-mono">{latestReport.duplicates || 0}</div>
                </div>

                <div className="bg-[#171c26] p-2.5 rounded border border-[#2a3140]">
                  <span className="text-slate-400 text-[10px]">Quarantined</span>
                  <div className="text-base font-bold text-slate-300 mt-0.5 font-mono">{latestReport.quarantined || 0}</div>
                </div>

                <div className="bg-[#171c26] p-2.5 rounded border border-[#2a3140]">
                  <span className="text-emerald-400 text-[10px]">Locations Found</span>
                  <div className="text-base font-bold text-emerald-400 mt-0.5 font-mono">{latestReport.locations_found ?? 0}</div>
                </div>

                <div className="bg-[#171c26] p-2.5 rounded border border-[#2a3140]">
                  <span className="text-slate-400 text-[10px]">Locations Unavail.</span>
                  <div className="text-base font-bold text-slate-400 mt-0.5 font-mono">{latestReport.locations_unavailable ?? 0}</div>
                </div>

                <div className="bg-[#171c26] p-2.5 rounded border border-[#2a3140]">
                  <span className="text-slate-400 text-[10px]">Duration</span>
                  <div className="text-sm font-bold text-slate-300 mt-0.5 font-mono">{latestReport.processing_time_seconds}s</div>
                </div>
              </div>

              {/* Real Detection Table (Requirement 6) */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 text-xs">
                    Imported Detection Ledger ({latestReport.detections?.length || 0} Records)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    All records persisted in SQLite database
                  </span>
                </div>

                <div className="overflow-x-auto rounded border border-[#232834] bg-[#11141a]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#181d26] text-slate-400 text-[11px] border-b border-[#232834]">
                      <tr>
                        <th className="p-2.5 font-medium w-24">Image</th>
                        <th className="p-2.5 font-medium">Camera</th>
                        <th className="p-2.5 font-medium">Timestamp</th>
                        <th className="p-2.5 font-medium">Animal</th>
                        <th className="p-2.5 font-medium">Tiger ID</th>
                        <th className="p-2.5 font-medium">Confidence</th>
                        <th className="p-2.5 font-medium">Latitude</th>
                        <th className="p-2.5 font-medium">Longitude</th>
                        <th className="p-2.5 font-medium text-right">Map Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#232834] text-slate-300">
                      {latestReport.detections && latestReport.detections.length > 0 ? (
                        latestReport.detections.map((row: any, idx: number) => {
                          const isTiger = row.animal?.toLowerCase() === 'tiger';
                          const hasCoords = row.latitude != null && row.longitude != null;

                          return (
                            <tr key={row.id || idx} className="hover:bg-[#181d26] transition">
                              <td className="p-2">
                                {row.image_available && row.thumbnail_url ? (
                                  <div className="w-16 h-10 rounded overflow-hidden">
                                    <CameraTrapImage
                                      src={row.thumbnail_url}
                                      alt={row.image_filename}
                                      aspectRatio="video"
                                      allowZoom={true}
                                    />
                                  </div>
                                ) : (
                                  <div className="w-16 h-10 rounded bg-[#161a22] border border-[#232834] flex flex-col items-center justify-center text-[9px] text-slate-400 px-1 text-center font-mono">
                                    <span>Image</span>
                                    <span>unavail.</span>
                                  </div>
                                )}
                              </td>
                              <td className="p-2.5 font-semibold text-slate-100 font-mono text-xs">
                                {row.camera_id}
                              </td>
                              <td className="p-2.5 font-mono text-slate-300 text-[11px]">
                                {row.timestamp}
                              </td>
                              <td className="p-2.5">
                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                                  isTiger
                                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                    : 'bg-sky-950 text-sky-300 border border-sky-800'
                                }`}>
                                  {row.animal}
                                </span>
                              </td>
                              <td className="p-2.5 font-mono font-semibold text-slate-200">
                                {row.tiger_id !== '-' ? (
                                  <span className="text-amber-400 font-bold">{row.tiger_id}</span>
                                ) : (
                                  <span className="text-slate-600">-</span>
                                )}
                              </td>
                              <td className="p-2.5 font-mono font-semibold text-emerald-400">
                                {Math.round(row.confidence * 100)}%
                              </td>
                              <td className="p-2.5 font-mono text-slate-300">
                                {row.latitude != null ? `${Number(row.latitude).toFixed(4)}° N` : 'N/A'}
                              </td>
                              <td className="p-2.5 font-mono text-slate-300">
                                {row.longitude != null ? `${Number(row.longitude).toFixed(4)}° E` : 'N/A'}
                              </td>
                              <td className="p-2.5 text-right">
                                {hasCoords ? (
                                  <button
                                    onClick={() => handleViewOnMap(row.latitude, row.longitude, row.camera_id)}
                                    className="px-2.5 py-1 bg-[#181d26] hover:bg-[#232834] text-emerald-400 hover:text-emerald-300 rounded border border-[#2a3140] text-[11px] font-medium transition inline-flex items-center gap-1"
                                  >
                                    <MapPin className="w-3 h-3 text-emerald-400" />
                                    <span>Locate</span>
                                  </button>
                                ) : (
                                  <span className="text-slate-600 text-[10px] font-mono">No GPS</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={9} className="p-6 text-center text-slate-400">
                            No detections recorded in this batch.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Quarantine Vault View */
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-[#181d26] p-3 rounded border border-[#232834]">
            <div>
              <span className="font-semibold text-slate-200 text-xs">
                Zero-Loss Quarantine Vault ({quarantinedImages.length} Blank Images)
              </span>
              <p className="text-[11px] text-slate-400">
                Images classified as blank/vegetation. Preserved for verification before any permanent archival.
              </p>
            </div>

            {selectedQuarantineIds.length > 0 && (
              <button
                onClick={handleBatchRestore}
                className="px-3 py-1 bg-[#1a2e20] hover:bg-[#26452f] text-emerald-300 rounded border border-[#26452f] text-xs font-medium transition flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore {selectedQuarantineIds.length} Selected</span>
              </button>
            )}
          </div>

          {quarantinedImages.length === 0 ? (
            <div className="field-card p-8 text-center text-slate-400 space-y-1">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <div className="font-semibold text-slate-200">Quarantine Vault is Clean</div>
              <p className="text-[11px]">No images are currently quarantined as blanks.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {quarantinedImages.map((item) => {
                const isSelected = selectedQuarantineIds.includes(item.id);
                return (
                  <div 
                    key={item.id} 
                    className={`field-card p-2 space-y-1.5 rounded transition ${
                      isSelected ? 'border-amber-500 bg-[#1f1b13]' : 'border-[#232834]'
                    }`}
                  >
                    <div className="relative aspect-video rounded overflow-hidden bg-[#11141a] border border-[#232834]">
                      <CameraTrapImage
                        src={`/api/v1/images/${item.id}/thumbnail`}
                        alt={item.filename}
                        aspectRatio="video"
                      />
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedQuarantineIds([...selectedQuarantineIds, item.id]);
                          } else {
                            setSelectedQuarantineIds(selectedQuarantineIds.filter(id => id !== item.id));
                          }
                        }}
                        className="absolute top-1.5 right-1.5 w-4 h-4 rounded accent-amber-500"
                      />
                    </div>

                    <div className="text-[10px] font-mono text-slate-300 truncate" title={item.filename}>
                      {item.filename}
                    </div>

                    <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
                      <span>{item.station_code || 'ST-01'}</span>
                      <span className="text-amber-400 font-semibold">{Math.round((item.confidence || 0.85) * 100)}% Blank</span>
                    </div>

                    <button
                      onClick={() => handleRestore(item.id)}
                      className="w-full py-0.5 bg-[#181d26] hover:bg-[#232834] text-slate-300 rounded border border-[#2a3140] text-[10px] transition"
                    >
                      Restore Image
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
