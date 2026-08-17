import React, { useState, useEffect } from 'react';
import { ApiClient, resolveMediaUrl } from '../../api/client';
import { CameraTrapImage } from './CameraTrapImage';
import { 
  X, CheckCircle, AlertTriangle, ShieldCheck, MapPin, 
  Clock, Camera, FileText, Sparkles, Cpu, Layers
} from 'lucide-react';

interface ImageDetailModalProps {
  imageId: string;
  onClose: () => void;
}

export const ImageDetailModal: React.FC<ImageDetailModalProps> = ({ imageId, onClose }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'crops' | 'exif'>('overview');

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const details = await ApiClient.getImageDetails(imageId);
        setData(details);
      } catch (err: any) {
        setError(err.message || 'Failed to load image analysis data');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [imageId]);

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 text-xs"
      onClick={onClose}
    >
      <div 
        className="bg-[#141820] border border-[#2e3544] rounded-lg max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#232834] bg-[#0f1218]">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-slate-100 text-sm">
              Camera Trap Capture Inspection & ML Analysis
            </span>
            {data && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1c232f] text-slate-300 border border-[#2a3444]">
                {data.filename}
              </span>
            )}
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-[#232834] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-mono">
            Loading camera trap capture and ML telemetry...
          </div>
        ) : error || !data ? (
          <div className="p-8 text-center space-y-2">
            <div className="text-rose-400 font-medium">PROCESSING FAILED / TELEMETRY UNAVAILABLE</div>
            <div className="text-slate-400 text-xs font-mono">{error || 'Data could not be retrieved from database'}</div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Top Grid: Actual Image + Analysis Summary */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Actual Image with Bounding Box Overlay */}
              <div className="md:col-span-7 space-y-2">
                <div className="relative rounded overflow-hidden border border-[#2e3544] bg-black">
                  <CameraTrapImage
                    src={data.image_url || data.thumbnail_url}
                    alt={data.filename}
                    aspectRatio="video"
                    allowZoom={true}
                    caption={`Source: ${data.filename} • Station: ${data.station_code}`}
                  />

                  {/* Bounding box overlay if tiger detected */}
                  {data.is_tiger && data.bbox && (
                    <div 
                      className="absolute border-2 border-amber-400 bg-amber-400/10 pointer-events-none rounded-xs"
                      style={{
                        left: `${data.bbox[0] * 100}%`,
                        top: `${data.bbox[1] * 100}%`,
                        width: `${data.bbox[2] * 100}%`,
                        height: `${data.bbox[3] * 100}%`,
                      }}
                    >
                      <span className="absolute -top-4 left-0 bg-amber-500 text-black text-[9px] font-mono font-bold px-1 rounded-xs">
                        {data.tiger_id || 'TIGER'} ({Math.round(data.confidence * 100)}%)
                      </span>
                    </div>
                  )}
                </div>

                {/* Sub-Tabs */}
                <div className="flex items-center gap-2 border-b border-[#232834] pt-1">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`pb-1.5 px-2 text-xs font-medium transition ${
                      activeTab === 'overview'
                        ? 'border-b-2 border-emerald-500 text-white font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Analysis Overview
                  </button>
                  <button
                    onClick={() => setActiveTab('crops')}
                    className={`pb-1.5 px-2 text-xs font-medium transition ${
                      activeTab === 'crops'
                        ? 'border-b-2 border-emerald-500 text-white font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Actual ML Crops ({data.is_tiger ? '2 Available' : '0'})
                  </button>
                  <button
                    onClick={() => setActiveTab('exif')}
                    className={`pb-1.5 px-2 text-xs font-medium transition ${
                      activeTab === 'exif'
                        ? 'border-b-2 border-emerald-500 text-white font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    EXIF Metadata
                  </button>
                </div>

                {activeTab === 'crops' && (
                  <div className="p-3 bg-[#0f1218] border border-[#232834] rounded space-y-3">
                    {data.is_tiger ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <div className="text-[10px] font-mono text-slate-400 uppercase">1. Actual Tiger Crop</div>
                          <div className="border border-[#2e3544] rounded overflow-hidden bg-black aspect-video">
                            <img 
                              src={resolveMediaUrl(data.crop_url || `/api/v1/images/${data.id}/crop`) || ''} 
                              alt="Tiger Crop" 
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          </div>
                          <div className="text-[9px] font-mono text-slate-500">Cropped from real photo bbox</div>
                        </div>

                        <div className="space-y-1">
                          <div className="text-[10px] font-mono text-slate-400 uppercase">2. Flank Stripe Crop ({data.flank_side})</div>
                          <div className="border border-[#2e3544] rounded overflow-hidden bg-black aspect-video">
                            <img 
                              src={resolveMediaUrl(data.flank_url || `/api/v1/images/${data.id}/flank`) || ''} 
                              alt="Flank Crop" 
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          </div>
                          <div className="text-[9px] font-mono text-slate-500">128-D Stripe Vector Input</div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-slate-500 font-mono py-4">
                        No tiger or flank crop extracted (Class: {data.animal}).
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'exif' && (
                  <div className="p-3 bg-[#0f1218] border border-[#232834] rounded space-y-2 font-mono text-[11px] max-h-48 overflow-y-auto">
                    {Object.keys(data.exif_data || {}).length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 text-slate-300">
                        {Object.entries(data.exif_data).map(([k, v]) => (
                          <div key={k} className="p-1 bg-[#141820] rounded border border-[#232834]">
                            <span className="text-slate-500 text-[10px]">{k}:</span> {String(v)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-slate-500">No EXIF tags embedded in file header.</div>
                    )}
                  </div>
                )}
              </div>

              {/* Right: Structured Telemetry & ML Ledger */}
              <div className="md:col-span-5 space-y-3">
                <div className="p-3 bg-[#0f1218] border border-[#232834] rounded space-y-2.5">
                  <div className="text-[10px] font-mono uppercase text-slate-400 tracking-wider flex items-center gap-1.5 border-b border-[#232834] pb-1.5">
                    <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                    <span>ML Pipeline Inference Telemetry</span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Processing Status:</span>
                      <span className="font-mono text-emerald-300 font-semibold px-1.5 py-0.2 rounded bg-emerald-950/80 border border-emerald-800">
                        {data.processing_status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Timestamp:</span>
                      <span className="font-mono text-slate-200">{data.timestamp_formatted}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Camera Station:</span>
                      <span className="font-mono text-slate-200 font-medium">{data.station_code} ({data.zone})</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">GPS Coordinates:</span>
                      <span className="font-mono text-slate-200">
                        {data.latitude != null && data.longitude != null
                          ? `${data.latitude}° N, ${data.longitude}° E`
                          : 'Unavailable (No GPS)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stage 1: Quality & Blank Analysis */}
                <div className="p-3 bg-[#0f1218] border border-[#232834] rounded space-y-2">
                  <div className="text-[10px] font-mono uppercase text-slate-400 flex items-center justify-between border-b border-[#232834] pb-1">
                    <span>Stage 1: Triage Classification</span>
                    <span className="text-slate-500">v2.1</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Class Detected:</span>
                    <span className={`font-mono font-semibold capitalize ${
                      data.animal === 'blank' ? 'text-amber-400' : 'text-emerald-300'
                    }`}>
                      {data.animal}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Confidence Score:</span>
                    <span className="font-mono text-slate-200">{Math.round(data.confidence * 100)}%</span>
                  </div>
                </div>

                {/* Stage 2 & 3: Re-ID & Stripe Extraction */}
                <div className="p-3 bg-[#0f1218] border border-[#232834] rounded space-y-2">
                  <div className="text-[10px] font-mono uppercase text-slate-400 flex items-center justify-between border-b border-[#232834] pb-1">
                    <span>Stage 2 & 3: Re-Identification & Flank Matching</span>
                    <span className="text-slate-500">128-D Cosine</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Tiger Detected:</span>
                    <span className="font-mono text-slate-200 font-semibold">{data.is_tiger ? 'YES' : 'NO'}</span>
                  </div>

                  {data.is_tiger && (
                    <>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Enrolled Tiger ID:</span>
                        <span className="font-mono text-amber-300 font-bold px-1.5 py-0.2 rounded bg-amber-950/80 border border-amber-800">
                          {data.tiger_id || 'T-PROV'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Flank Orientation:</span>
                        <span className="font-mono text-slate-200 uppercase">{data.flank_side}</span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Re-ID Match Result:</span>
                        <span className="font-mono text-emerald-300 font-medium">{data.re_id_result}</span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Stripe Similarity:</span>
                        <span className="font-mono text-slate-200">{Math.round(data.similarity_score * 100)}%</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-[#232834] bg-[#0f1218] flex items-center justify-between text-[11px] text-slate-400">
          <span>Actual Camera Trap Intake • Zero Generative Content Rule</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-[#1e232d] hover:bg-[#282e3c] text-slate-200 rounded border border-[#2e3544] font-medium"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
