import React, { useState, useEffect, useRef } from 'react';
import { ApiClient, resolveMediaUrl } from '../api/client';
import { useWebSocket } from '../context/WebSocketContext';
import { 
  FolderUp, HardDrive, ShieldAlert, CheckCircle2, RotateCcw, 
  Play, Search, ShieldCheck, FileCheck, RefreshCw, 
  MapPin, AlertCircle, FileText, Database, Map, ArrowRight, FileSpreadsheet,
  Grid, List, Filter, Eye, Sparkles
} from 'lucide-react';
import { CameraTrapImage } from '../components/common/CameraTrapImage';
import { ImageDetailModal } from '../components/common/ImageDetailModal';
import { DetectionResult } from '../types';

interface IngestionPageProps {
  onNavigateToMap?: (params?: { lat?: number; lon?: number; station?: string }) => void;
}

export const IngestionPage: React.FC<IngestionPageProps> = ({ onNavigateToMap }) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [folderPath, setFolderPath] = useState('');
  
  // Step 2: Mandatory CSV Metadata State
  const [csvContent, setCsvContent] = useState<string>('');
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvStationCount, setCsvStationCount] = useState<number>(0);
  const [showCsvEditor, setShowCsvEditor] = useState<boolean>(false);

  // Validation State & Client-Side Errors
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationReport, setValidationReport] = useState<any>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Execution & Live Progress State
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState<string>('Idle');
  const [liveProgress, setLiveProgress] = useState<any>(null);
  const [latestReport, setLatestReport] = useState<any>(null);
  const [allDetections, setAllDetections] = useState<DetectionResult[]>([]);

  // Gallery Controls (Search, Filter, View Mode)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTigerFilter, setSelectedTigerFilter] = useState<string>('all');
  const [selectedCameraFilter, setSelectedCameraFilter] = useState<string>('all');
  const [selectedAnimalFilter, setSelectedAnimalFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Quarantine & Modal
  const [quarantinedImages, setQuarantinedImages] = useState<any[]>([]);
  const [selectedQuarantineIds, setSelectedQuarantineIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'import' | 'quarantine'>('import');
  const [selectedInspectImageId, setSelectedInspectImageId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
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
      if (data.detections) {
        setAllDetections(data.detections);
      }
      setIsIngesting(false);
      setCurrentStage('Complete');
      loadQuarantine();
    });

    return () => {
      unsubProgress();
      unsubComplete();
    };
  }, [subscribe]);

  // Client-Side CSV Validation & Filename Cross-Checking
  const validateIntakeLocally = (files: File[], csvText: string) => {
    const errors: string[] = [];

    const hasImages = files.length > 0;
    const hasCsv = Boolean(csvText && csvText.trim());

    if (!hasImages && !hasCsv) {
      return { valid: false, errors: [] };
    }
    if (hasImages && !hasCsv) {
      errors.push("CSV metadata file is required. Please upload the CSV before starting analysis.");
      return { valid: false, errors };
    }
    if (!hasImages && hasCsv) {
      errors.push("At least one image is required. Please upload images before starting analysis.");
      return { valid: false, errors };
    }

    // Check CSV contents
    const lines = csvText.trim().split('\n').filter(l => l.trim());
    if (lines.length <= 1) {
      errors.push("CSV validation failed: CSV file contains no data rows.");
      return { valid: false, errors };
    }

    const header = lines[0].toLowerCase().split(',').map(h => h.trim());
    
    // Check required core spatial-temporal metadata columns
    const missing: string[] = [];
    if (!header.some(h => ['image', 'filename', 'file', 'image_name', 'photo'].includes(h))) missing.push('image');
    if (!header.some(h => ['camera_id', 'camera', 'station_id', 'station', 'cam_id'].includes(h))) missing.push('camera_id');
    if (!header.some(h => ['timestamp', 'datetime', 'date_time', 'time', 'date'].includes(h))) missing.push('timestamp');
    if (!header.some(h => ['latitude', 'lat'].includes(h))) missing.push('latitude');
    if (!header.some(h => ['longitude', 'lon', 'lng', 'long'].includes(h))) missing.push('longitude');

    if (missing.length > 0) {
      errors.push(`CSV validation failed: Missing required column(s): ${missing.join(', ')}.`);
    }

    // Check filenames match
    const uploadedNames = new Set(files.map(f => f.name.toLowerCase()));
    const csvNames = new Set<string>();

    const imgColIdx = header.findIndex(h => ['image', 'filename', 'file', 'image_name'].includes(h));
    if (imgColIdx !== -1) {
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim());
        const rawName = parts[imgColIdx] || '';
        const cleanName = rawName.split('/').pop()?.split('\\').pop() || '';
        if (cleanName) {
          csvNames.add(cleanName.toLowerCase());
          if (!uploadedNames.has(cleanName.toLowerCase())) {
            errors.push(`CSV validation failed:\n${cleanName} exists in CSV but was not uploaded.`);
          }
        }
      }

      files.forEach(f => {
        if (!csvNames.has(f.name.toLowerCase())) {
          errors.push(`CSV validation failed:\n${f.name} was uploaded but does not exist in CSV.`);
        }
      });
    }

    return { valid: errors.length === 0, errors };
  };

  // Re-run validation on file/csv updates
  useEffect(() => {
    const res = validateIntakeLocally(selectedFiles, csvContent);
    setValidationErrors(res.errors);
    setValidationReport({
      valid: res.valid,
      total_images: selectedFiles.length,
      csv_rows_count: csvContent ? csvContent.trim().split('\n').length - 1 : 0
    });
  }, [selectedFiles, csvContent]);

  const handleFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileList = Array.from(files).filter(f => f.type.startsWith('image/') || f.name.match(/\.(jpg|jpeg|png)$/i));
      setSelectedFiles(fileList);
      if (fileList.length > 0) {
        setFolderPath(`Batch (${fileList.length} files)`);
      }
    }
  };

  const handleFolderPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileList = Array.from(files).filter(f => f.type.startsWith('image/') || f.name.match(/\.(jpg|jpeg|png)$/i));
      setSelectedFiles(fileList);
      const firstFile = fileList[0];
      const relPath = (firstFile as any).webkitRelativePath;
      const rootFolder = relPath ? relPath.split('/')[0] : 'Selected Images';
      setFolderPath(rootFolder);
    }
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      setCsvFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setCsvContent(text);
        const rows = text.trim().split('\n').filter(r => r.trim());
        setCsvStationCount(Math.max(0, rows.length - 1));
      };
      reader.readAsText(file);
    }
  };

  const handleStartIngest = async () => {
    if (selectedFiles.length === 0 && !csvContent) {
      setIngestError("Both image files and a CSV metadata file are required.");
      return;
    }
    if (selectedFiles.length === 0) {
      setIngestError("At least one image is required. Please upload images before starting analysis.");
      return;
    }
    if (!csvContent || !csvContent.trim()) {
      setIngestError("CSV metadata file is required. Please upload the CSV before starting analysis.");
      return;
    }

    const localCheck = validateIntakeLocally(selectedFiles, csvContent);
    if (!localCheck.valid) {
      setIngestError(localCheck.errors.join('\n'));
      return;
    }

    setIsIngesting(true);
    setIngestError(null);
    setCurrentStage('Processing');
    setLiveProgress({ 
      processed: 0, 
      total: selectedFiles.length, 
      progress_pct: 0 
    });
    setLatestReport(null);

    try {
      const report = await ApiClient.ingestFiles(selectedFiles, undefined, csvContent, csvFile);
      setLatestReport(report);
      if (report.detections) {
        setAllDetections(report.detections);
      }
      setCurrentStage('Complete');
      loadQuarantine();
    } catch (err: any) {
      setIngestError(err.message || 'Ingestion and processing failed');
      setCurrentStage('Idle');
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

  // Filtered Detections
  const filteredDetections = allDetections.filter((item) => {
    if (selectedTigerFilter !== 'all' && item.tiger_id !== selectedTigerFilter) return false;
    if (selectedCameraFilter !== 'all' && item.camera_id !== selectedCameraFilter) return false;
    if (selectedAnimalFilter !== 'all' && item.animal.toLowerCase() !== selectedAnimalFilter.toLowerCase()) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchFile = item.image_filename.toLowerCase().includes(q);
      const matchTiger = item.tiger_id.toLowerCase().includes(q);
      const matchCam = item.camera_id.toLowerCase().includes(q);
      const matchBehavior = (item.behavior || '').toLowerCase().includes(q);
      if (!matchFile && !matchTiger && !matchCam && !matchBehavior) return false;
    }
    return true;
  });

  const uniqueTigerOptions = Array.from(new Set(allDetections.map(d => d.tiger_id).filter(id => id && id !== '-')));
  const uniqueCameraOptions = Array.from(new Set(allDetections.map(d => d.camera_id).filter(Boolean)));
  const uniqueAnimalOptions = Array.from(new Set(allDetections.map(d => d.animal).filter(Boolean)));

  const isFormReady = selectedFiles.length > 0 && Boolean(csvContent && csvContent.trim()) && validationErrors.length === 0;

  return (
    <div className="p-4 space-y-4 max-w-[1600px] mx-auto text-xs">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#232834]">
        <div>
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
            <FolderUp className="w-4 h-4 text-emerald-400" />
            <span>IMAGE & CSV INGESTION PIPELINE</span>
          </h2>
          <p className="text-[11px] text-slate-400">
            Mandatory dual-source intake: upload camera photos + CSV manifest to execute AI triage, individual stripe Re-ID, and geospatial alignment.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-[#181d26] p-0.5 rounded border border-[#2a3140]">
          <button
            onClick={() => setActiveTab('import')}
            className={`px-3 py-1 rounded text-xs font-medium transition ${
              activeTab === 'import' ? 'bg-[#232834] text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Intake & Processing
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
          {/* 3-Step Wizard Container */}
          <div className="field-card p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-[#232834] pb-2">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-slate-100 text-sm">MANDATORY IMAGE + CSV INGESTION GATES</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-[#1a2e20] px-2.5 py-0.5 rounded border border-[#26452f] flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Original Image Quality Preserved</span>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* STEP 1: Upload Image Files */}
              <div className="p-3 rounded bg-[#11141a] border border-[#232834] flex flex-col justify-between space-y-2.5">
                <div>
                  <div className="text-[10px] font-mono text-emerald-400 font-semibold tracking-wider flex items-center justify-between">
                    <span>STEP 1 (MANDATORY)</span>
                    <span className="text-rose-400 text-[10px] font-bold">* Required</span>
                  </div>
                  <div className="font-medium text-slate-200 text-xs mt-0.5">Camera-Trap Images</div>
                  <p className="text-[11px] text-slate-400 mt-1">Select one or more image files (or entire folder).</p>
                </div>

                <div className="space-y-2">
                  <input
                    type="file"
                    ref={multiFileInputRef}
                    onChange={handleFilesUpload}
                    multiple
                    accept="image/jpeg,image/png,image/jpg"
                    className="hidden"
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

                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => multiFileInputRef.current?.click()}
                      className="flex-1 px-3 py-1.5 bg-[#181d26] hover:bg-[#232834] text-slate-200 border border-[#2a3140] rounded text-xs font-medium transition flex items-center justify-center gap-1.5"
                    >
                      <FolderUp className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{selectedFiles.length > 0 ? `Selected (${selectedFiles.length} images)` : 'Upload Images'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1.5 bg-[#181d26] hover:bg-[#232834] text-slate-300 border border-[#2a3140] rounded text-xs transition"
                      title="Select Entire Image Directory"
                    >
                      📁 Folder
                    </button>
                  </div>

                  {/* Step 1 Badge */}
                  {selectedFiles.length > 0 ? (
                    <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1 bg-[#142319] p-1.5 rounded border border-[#233f2b]">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>✓ {selectedFiles.length} image files selected</span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-amber-400/90 font-mono italic">⚠ Please select image files</div>
                  )}
                </div>
              </div>

              {/* STEP 2: Upload CSV Metadata File */}
              <div className="p-3 rounded bg-[#11141a] border border-[#232834] flex flex-col justify-between space-y-2.5">
                <div>
                  <div className="text-[10px] font-mono text-emerald-400 font-semibold tracking-wider flex items-center justify-between">
                    <span>STEP 2 (MANDATORY)</span>
                    <span className="text-rose-400 text-[10px] font-bold">* Required</span>
                  </div>
                  <div className="font-medium text-slate-200 text-xs mt-0.5">CSV Metadata Manifest</div>
                  <p className="text-[11px] text-slate-400 mt-1">Upload CSV with image, camera_id, timestamp, lat, lon, animal, tiger_id, confidence.</p>
                </div>

                <div className="space-y-2">
                  <input
                    type="file"
                    ref={csvInputRef}
                    accept=".csv"
                    onChange={handleCsvFileUpload}
                    className="hidden"
                  />

                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => csvInputRef.current?.click()}
                      className="flex-1 px-3 py-1.5 bg-[#181d26] hover:bg-[#232834] text-slate-200 border border-[#2a3140] rounded text-xs font-medium transition flex items-center justify-center gap-1.5"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
                      <span>{csvFileName ? `CSV: ${csvFileName}` : 'Upload CSV Manifest'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCsvEditor(!showCsvEditor)}
                      className={`px-2.5 py-1.5 rounded text-xs border transition ${showCsvEditor ? 'bg-amber-950/60 border-amber-700 text-amber-300' : 'bg-[#181d26] border-[#2a3140] text-slate-300'}`}
                      title="Inspect / Edit CSV Content"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Step 2 Badge */}
                  {csvStationCount > 0 ? (
                    <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1 bg-[#142319] p-1.5 rounded border border-[#233f2b]">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>✓ {csvStationCount} records loaded ({csvFileName || 'CSV'})</span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-amber-400/90 font-mono italic">⚠ Please upload CSV metadata</div>
                  )}
                </div>
              </div>

              {/* STEP 3: Analysis Execution Gate */}
              <div className="p-3 rounded bg-[#11141a] border border-[#232834] flex flex-col justify-between space-y-2.5">
                <div>
                  <div className="text-[10px] font-mono text-emerald-400 font-semibold tracking-wider">STEP 3</div>
                  <div className="font-medium text-slate-200 text-xs mt-0.5">Execute AI Inference</div>
                  <p className="text-[11px] text-slate-400 mt-1">Processes EVERY uploaded image and aligns coordinates.</p>
                </div>

                <div className="space-y-2">
                  <div className="space-y-1 font-mono text-[11px]">
                    {selectedFiles.length > 0 ? (
                      <div className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>✓ {selectedFiles.length} images ready</span>
                      </div>
                    ) : (
                      <div className="text-slate-500 flex items-center gap-1">
                        <span className="w-3 h-3 block rounded-full border border-slate-600" />
                        <span>Waiting for images...</span>
                      </div>
                    )}

                    {csvContent ? (
                      <div className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>✓ CSV manifest loaded</span>
                      </div>
                    ) : (
                      <div className="text-slate-500 flex items-center gap-1">
                        <span className="w-3 h-3 block rounded-full border border-slate-600" />
                        <span>Waiting for CSV...</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleStartIngest}
                    disabled={!isFormReady || isIngesting}
                    className="w-full py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:hover:bg-emerald-700 text-white font-semibold text-xs rounded transition flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{isIngesting ? 'Processing AI Pipeline...' : 'START ANALYSIS'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Validation Error Notices Banner */}
            {validationErrors.length > 0 && (
              <div className="p-3 rounded bg-rose-950/50 border border-rose-800 text-rose-200 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Validation Warning</span>
                </div>
                <div className="space-y-0.5 text-[11px] font-mono whitespace-pre-line pl-5">
                  {validationErrors.map((err, i) => (
                    <div key={i}>• {err}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Ingest Runtime Error Banner */}
            {ingestError && (
              <div className="p-3 rounded bg-rose-950/70 border border-rose-700 text-rose-100 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Execution Error</span>
                </div>
                <div className="text-[11px] font-mono pl-5 whitespace-pre-line">{ingestError}</div>
              </div>
            )}

            {/* CSV Quick Editor / Viewer */}
            {showCsvEditor && (
              <div className="p-3 rounded bg-[#161a22] border border-[#2a3140] space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                  <span>CSV Manifest Content</span>
                  <button onClick={() => setShowCsvEditor(false)} className="text-slate-400 hover:text-white text-xs">Close</button>
                </div>
                <textarea
                  rows={5}
                  value={csvContent}
                  onChange={(e) => {
                    setCsvContent(e.target.value);
                    const rows = e.target.value.trim().split('\n').filter(r => r.trim());
                    setCsvStationCount(Math.max(0, rows.length - 1));
                  }}
                  placeholder={"image,camera_id,timestamp,latitude,longitude,animal,tiger_id,confidence,behavior,sex,age\nimg1.jpg,CAM001,2026-08-17 10:30:00,21.7584,79.3142,tiger,T001,0.94,walking,Female,Adult"}
                  className="w-full bg-[#0f1217] border border-[#232834] text-slate-100 font-mono text-[11px] p-2 rounded focus:outline-none focus:border-slate-500"
                />
              </div>
            )}
          </div>

          {/* Live Progress Bar Indicator */}
          {isIngesting && liveProgress && (
            <div className="field-card p-4 space-y-3 bg-[#131720] border-emerald-800">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-100 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
                  <span>AI Inference in Progress: Processing {liveProgress.processed || 0} of {liveProgress.total || selectedFiles.length} images</span>
                </span>
                <span className="font-mono text-emerald-400 font-bold text-sm">{liveProgress.progress_pct || 0}%</span>
              </div>

              <div className="w-full h-3 bg-[#11141a] rounded overflow-hidden border border-[#232834]">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-300"
                  style={{ width: `${liveProgress.progress_pct || 0}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Current Stage: <strong className="text-emerald-400">{currentStage}</strong></span>
                <span>Tigers Detected: <strong className="text-amber-400">{liveProgress.tiger_images || 0}</strong></span>
              </div>
            </div>
          )}

          {/* Complete Image Results Gallery & Inspection Ledger */}
          {allDetections.length > 0 && (
            <div className="field-card p-4 space-y-4 border-slate-600 bg-[#12161f]">
              {/* Header & Map Action Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#232834]">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-sm font-bold text-slate-100">
                      Processed Results Gallery ({allDetections.length} Total Images)
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    High-resolution photos with individual Re-ID classification and GPS coordinates.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const firstLoc = allDetections.find((d) => d.latitude != null && d.longitude != null);
                      handleViewOnMap(firstLoc?.latitude, firstLoc?.longitude, firstLoc?.camera_id);
                    }}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-semibold text-xs transition shadow-lg flex items-center gap-2 cursor-pointer"
                  >
                    <Map className="w-4 h-4" />
                    <span>View All on Map</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Search and Filters Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded bg-[#171c26] border border-[#2a3140]">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  {/* Text Search */}
                  <div className="relative min-w-[200px] flex-1 sm:flex-initial">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search image, tiger ID, camera..."
                      className="w-full bg-[#10141b] border border-[#232834] rounded pl-8 pr-2 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-500"
                    />
                  </div>

                  {/* Tiger ID Filter */}
                  {uniqueTigerOptions.length > 0 && (
                    <select
                      value={selectedTigerFilter}
                      onChange={(e) => setSelectedTigerFilter(e.target.value)}
                      className="bg-[#10141b] border border-[#232834] text-amber-300 text-xs rounded px-2 py-1 focus:outline-none font-mono"
                    >
                      <option value="all">All Tigers ({uniqueTigerOptions.length})</option>
                      {uniqueTigerOptions.map((t) => (
                        <option key={t} value={t}>🐅 {t}</option>
                      ))}
                    </select>
                  )}

                  {/* Camera Filter */}
                  {uniqueCameraOptions.length > 0 && (
                    <select
                      value={selectedCameraFilter}
                      onChange={(e) => setSelectedCameraFilter(e.target.value)}
                      className="bg-[#10141b] border border-[#232834] text-emerald-300 text-xs rounded px-2 py-1 focus:outline-none font-mono"
                    >
                      <option value="all">All Cameras ({uniqueCameraOptions.length})</option>
                      {uniqueCameraOptions.map((c) => (
                        <option key={c} value={c}>📷 {c}</option>
                      ))}
                    </select>
                  )}

                  {/* Animal Filter */}
                  {uniqueAnimalOptions.length > 0 && (
                    <select
                      value={selectedAnimalFilter}
                      onChange={(e) => setSelectedAnimalFilter(e.target.value)}
                      className="bg-[#10141b] border border-[#232834] text-slate-200 text-xs rounded px-2 py-1 focus:outline-none"
                    >
                      <option value="all">All Species</option>
                      {uniqueAnimalOptions.map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 bg-[#10141b] p-0.5 rounded border border-[#232834]">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1 rounded transition ${viewMode === 'grid' ? 'bg-[#232834] text-white' : 'text-slate-400 hover:text-white'}`}
                    title="Grid Card View"
                  >
                    <Grid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`p-1 rounded transition ${viewMode === 'table' ? 'bg-[#232834] text-white' : 'text-slate-400 hover:text-white'}`}
                    title="Table Ledger View"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* View 1: Card Grid Gallery */}
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                  {filteredDetections.map((item, idx) => {
                    const isTiger = item.animal.toLowerCase() === 'tiger';
                    const hasCoords = item.latitude != null && item.longitude != null;
                    const highResUrl = resolveMediaUrl(item.image_url || item.thumbnail_url);

                    return (
                      <div 
                        key={item.id || idx}
                        className="bg-[#151a24] rounded-lg border border-[#2a3140] overflow-hidden flex flex-col justify-between hover:border-slate-500 transition shadow-lg group"
                      >
                        {/* High-Resolution Image Container */}
                        <div 
                          className="relative aspect-video bg-black overflow-hidden cursor-pointer"
                          onClick={() => item.image_id && setSelectedInspectImageId(item.image_id)}
                        >
                          {highResUrl ? (
                            <img 
                              src={highResUrl} 
                              alt={item.image_filename}
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-500 font-mono text-[11px]">
                              No Image Preview
                            </div>
                          )}

                          {/* Animal / Species Tag */}
                          <div className="absolute top-2 left-2 flex items-center gap-1">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase shadow-md ${
                              isTiger ? 'bg-amber-950/90 text-amber-300 border border-amber-700' :
                              item.animal.toLowerCase().includes('deer') || item.animal.toLowerCase().includes('sambar') || item.animal.toLowerCase().includes('muntjac') ? 'bg-orange-950/90 text-orange-300 border border-orange-700' :
                              item.animal.toLowerCase().includes('cat') || item.animal.toLowerCase().includes('bobcat') ? 'bg-teal-950/90 text-teal-300 border border-teal-700' :
                              item.animal.toLowerCase().includes('leopard') ? 'bg-yellow-950/90 text-yellow-300 border border-yellow-700' :
                              item.animal.toLowerCase().includes('human') ? 'bg-rose-950/90 text-rose-300 border border-rose-700' :
                              item.animal.toLowerCase().includes('blank') ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-700' :
                              'bg-sky-950/90 text-sky-300 border border-sky-700'
                            }`}>
                              {isTiger ? `🐅 ${item.tiger_id && item.tiger_id !== '-' ? item.tiger_id : 'Tiger'}` :
                               item.animal.toLowerCase().includes('deer') || item.animal.toLowerCase().includes('muntjac') ? `🦌 ${item.animal}` :
                               item.animal.toLowerCase().includes('cat') || item.animal.toLowerCase().includes('bobcat') ? `🐱 ${item.animal}` :
                               item.animal.toLowerCase().includes('leopard') ? `🐆 ${item.animal}` :
                               item.animal.toLowerCase().includes('human') ? `👤 Human` :
                               item.animal.toLowerCase().includes('blank') ? `🍃 Blank` :
                               `🐾 ${item.animal}`}
                            </span>
                          </div>

                          {/* Confidence */}
                          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-emerald-400 text-[10px] font-mono font-bold border border-emerald-900 shadow">
                            {item.confidence_pct || `${Math.round(item.confidence * 100)}%`}
                          </div>
                        </div>

                        {/* Card Content & CSV Metadata */}
                        <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold text-slate-100 truncate font-mono" title={item.image_filename}>
                                {item.image_filename}
                              </span>
                              <span className="text-emerald-400 font-mono text-[10px]">📷 {item.camera_id}</span>
                            </div>

                            <div className="text-[10px] text-slate-400 font-mono">
                              🕒 {item.timestamp_formatted || item.timestamp}
                            </div>

                            {hasCoords ? (
                              <div className="text-[10px] text-slate-300 font-mono flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                                <span>{Number(item.latitude).toFixed(4)}° N, {Number(item.longitude).toFixed(4)}° E</span>
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-500 font-mono italic">No GPS coordinates</div>
                            )}

                            {/* Optional CSV details */}
                            <div className="flex flex-wrap gap-1 pt-1 text-[9px] font-mono text-slate-300">
                              {item.behavior && item.behavior !== '-' && (
                                <span className="px-1.5 py-0.2 rounded bg-[#1e2533] border border-[#2d374d]">
                                  Behavior: {item.behavior}
                                </span>
                              )}
                              {item.sex && item.sex !== '-' && (
                                <span className="px-1.5 py-0.2 rounded bg-[#1e2533] border border-[#2d374d]">
                                  Sex: {item.sex}
                                </span>
                              )}
                              {item.age_class && item.age_class !== '-' && (
                                <span className="px-1.5 py-0.2 rounded bg-[#1e2533] border border-[#2d374d]">
                                  Age: {item.age_class}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="pt-2 border-t border-[#232834] flex items-center gap-1.5">
                            {item.image_id && (
                              <button
                                onClick={() => setSelectedInspectImageId(item.image_id || '')}
                                className="flex-1 py-1.5 bg-[#1b212d] hover:bg-[#252d3d] text-slate-200 rounded text-[11px] font-medium border border-[#2e374a] transition flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3 h-3 text-slate-400" />
                                <span>Inspect</span>
                              </button>
                            )}

                            {hasCoords && (
                              <button
                                onClick={() => handleViewOnMap(item.latitude, item.longitude, item.camera_id)}
                                className="flex-1 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 rounded text-[11px] font-medium border border-emerald-800 transition flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <MapPin className="w-3 h-3 text-emerald-400" />
                                <span>View on Map</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* View 2: Table Ledger */
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
                        <th className="p-2.5 font-medium">Behavior</th>
                        <th className="p-2.5 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#232834] text-slate-300">
                      {filteredDetections.map((row, idx) => {
                        const isTiger = row.animal.toLowerCase() === 'tiger';
                        const hasCoords = row.latitude != null && row.longitude != null;
                        const highResUrl = resolveMediaUrl(row.image_url || row.thumbnail_url);

                        return (
                          <tr key={row.id || idx} className="hover:bg-[#181d26] transition">
                            <td className="p-2">
                              {highResUrl ? (
                                <div 
                                  className="w-16 h-10 rounded overflow-hidden bg-black cursor-pointer"
                                  onClick={() => row.image_id && setSelectedInspectImageId(row.image_id)}
                                >
                                  <img src={highResUrl} alt={row.image_filename} className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <div className="w-16 h-10 rounded bg-[#161a22] border border-[#232834] flex items-center justify-center text-[9px] text-slate-400 font-mono">
                                  No img
                                </div>
                              )}
                            </td>
                            <td className="p-2.5 font-semibold text-slate-100 font-mono text-xs">
                              {row.camera_id}
                            </td>
                            <td className="p-2.5 font-mono text-slate-300 text-[11px]">
                              {row.timestamp_formatted || row.timestamp}
                            </td>
                            <td className="p-2.5">
                              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                                isTiger ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                                row.animal.toLowerCase().includes('deer') || row.animal.toLowerCase().includes('muntjac') ? 'bg-orange-950 text-orange-300 border border-orange-800' :
                                row.animal.toLowerCase().includes('cat') || row.animal.toLowerCase().includes('bobcat') ? 'bg-teal-950 text-teal-300 border border-teal-800' :
                                row.animal.toLowerCase().includes('leopard') ? 'bg-yellow-950 text-yellow-300 border border-yellow-800' :
                                row.animal.toLowerCase().includes('human') ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                                row.animal.toLowerCase().includes('blank') ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                                'bg-sky-950 text-sky-300 border border-sky-800'
                              }`}>
                                {isTiger ? `🐅 Tiger` :
                                 row.animal.toLowerCase().includes('deer') || row.animal.toLowerCase().includes('muntjac') ? `🦌 ${row.animal}` :
                                 row.animal.toLowerCase().includes('cat') || row.animal.toLowerCase().includes('bobcat') ? `🐱 ${row.animal}` :
                                 row.animal.toLowerCase().includes('leopard') ? `🐆 ${row.animal}` :
                                 row.animal.toLowerCase().includes('human') ? `👤 Human` :
                                 row.animal.toLowerCase().includes('blank') ? `🍃 Blank` :
                                 `🐾 ${row.animal}`}
                              </span>
                            </td>
                            <td className="p-2.5 font-mono font-semibold text-slate-200">
                              {row.tiger_id !== '-' ? (
                                <span className="text-amber-400 font-bold">🐅 {row.tiger_id}</span>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>
                            <td className="p-2.5 font-mono font-semibold text-emerald-400">
                              {row.confidence_pct || `${Math.round(row.confidence * 100)}%`}
                            </td>
                            <td className="p-2.5 font-mono text-slate-300">
                              {row.latitude != null ? `${Number(row.latitude).toFixed(4)}° N` : 'N/A'}
                            </td>
                            <td className="p-2.5 font-mono text-slate-300">
                              {row.longitude != null ? `${Number(row.longitude).toFixed(4)}° E` : 'N/A'}
                            </td>
                            <td className="p-2.5 font-mono text-slate-400 text-[11px]">
                              {row.behavior || '-'}
                            </td>
                            <td className="p-2.5 text-right space-x-1.5 whitespace-nowrap">
                              {row.image_id && (
                                <button
                                  onClick={() => setSelectedInspectImageId(row.image_id || '')}
                                  className="px-2 py-1 bg-[#181d26] hover:bg-[#232834] text-slate-200 rounded border border-[#2a3140] text-[11px] font-medium transition inline-flex items-center gap-1 font-mono cursor-pointer"
                                >
                                  <Eye className="w-3 h-3 text-slate-400" />
                                  <span>Inspect</span>
                                </button>
                              )}

                              {hasCoords && (
                                <button
                                  onClick={() => handleViewOnMap(row.latitude, row.longitude, row.camera_id)}
                                  className="px-2 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 rounded border border-emerald-800 text-[11px] font-medium transition inline-flex items-center gap-1 font-mono cursor-pointer"
                                >
                                  <MapPin className="w-3 h-3 text-emerald-400" />
                                  <span>Locate</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
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

      {/* Image Inspection & ML Telemetry Modal */}
      {selectedInspectImageId && (
        <ImageDetailModal
          imageId={selectedInspectImageId}
          onClose={() => setSelectedInspectImageId(null)}
        />
      )}
    </div>
  );
};
