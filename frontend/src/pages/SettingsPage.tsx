import React, { useState } from 'react';
import { SlidersHorizontal, Save, Check, Cpu } from 'lucide-react';
import { ApiClient } from '../api/client';

export const SettingsPage: React.FC = () => {
  const [blankThreshold, setBlankThreshold] = useState(70);
  const [autoMatchThreshold, setAutoMatchThreshold] = useState(85);
  const [ambiguousLower, setAmbiguousLower] = useState(50);
  const [coreShiftKm, setCoreShiftKm] = useState(4.5);
  const [bufferMovementKm, setBufferMovementKm] = useState(5.0);
  const [villageDistanceKm, setVillageDistanceKm] = useState(1.5);
  const [minObservationsMCP, setMinObservationsMCP] = useState(5);
  const [absenceDays, setAbsenceDays] = useState(45);
  const [saved, setSaved] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState<any>(null);
  const [isRunningBench, setIsRunningBench] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleRunLiveBenchmark = async () => {
    setIsRunningBench(true);
    try {
      const res = await ApiClient.getBenchmark(30);
      setBenchmarkResult(res);
    } catch (err: any) {
      alert(`Benchmark error: ${err.message}`);
    } finally {
      setIsRunningBench(false);
    }
  };

  return (
    <div className="p-5 space-y-5 max-w-[1300px] mx-auto text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1c3525]">
        <div>
          <h2 className="text-base font-semibold text-emerald-100 flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-emerald-400" />
            <span>AI Triage, Stripe Biometrics & Ecological Threshold Configuration</span>
          </h2>
          <p className="text-xs text-emerald-400/70 mt-0.5">
            Calibrate machine learning decision boundaries, bilateral flank re-ID parameters, and spatial deviation alert sensitivity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunLiveBenchmark}
            disabled={isRunningBench}
            className="px-3 py-1.5 bg-[#162b1e] hover:bg-[#1f3b2a] text-emerald-200 rounded border border-[#2d523b] transition flex items-center gap-1.5"
          >
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isRunningBench ? 'Benchmarking Hardware...' : 'Run Live Hardware Benchmark'}</span>
          </button>

          <button
            onClick={handleSave}
            className="px-4 py-1.5 bg-[#2c1e15] hover:bg-[#3d2c1e] text-amber-200 font-semibold rounded border border-[#5e3f2b] transition flex items-center gap-1.5"
          >
            {saved ? <Check className="w-4 h-4 text-emerald-400" /> : <Save className="w-4 h-4" />}
            <span>{saved ? 'Thresholds Saved' : 'Save Policies'}</span>
          </button>
        </div>
      </div>

      {/* Live Benchmark Panel (If Triggered) */}
      {benchmarkResult && (
        <div className="field-card p-4 space-y-3 bg-[#0c1a11] border-emerald-500/50">
          <div className="flex items-center justify-between pb-2 border-b border-[#1c3525]">
            <div className="flex items-center gap-2 font-bold text-emerald-200">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>Live AI Engine Hardware Benchmark Results</span>
            </div>
            <span className="font-mono text-[11px] text-emerald-400">{benchmarkResult.device}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-[#07100a] p-2.5 rounded border border-[#1c3525]">
              <span className="text-emerald-400/70 text-[10px]">Total Latency</span>
              <div className="text-base font-bold text-emerald-100 font-mono mt-0.5">
                {benchmarkResult.stages_latency_ms.total_pipeline_avg_ms} ms
              </div>
            </div>
            <div className="bg-[#07100a] p-2.5 rounded border border-[#1c3525]">
              <span className="text-emerald-400/70 text-[10px]">Processing Speed</span>
              <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">
                {benchmarkResult.throughput.images_per_minute} img/min
              </div>
            </div>
            <div className="bg-[#07100a] p-2.5 rounded border border-[#1c3525]">
              <span className="text-emerald-400/70 text-[10px]">RAM Footprint</span>
              <div className="text-base font-bold text-slate-100 font-mono mt-0.5">
                {benchmarkResult.memory_usage_mb} MB
              </div>
            </div>
            <div className="bg-[#07100a] p-2.5 rounded border border-[#1c3525]">
              <span className="text-amber-400 text-[10px]">10K SD Card Time</span>
              <div className="text-base font-bold text-amber-300 font-mono mt-0.5">
                {benchmarkResult.throughput['10k_sd_card_triage_estimate_minutes']} min
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
        {/* ML Triage & Bilateral Flank Policies */}
        <div className="field-card p-4 space-y-4">
          <h3 className="font-bold text-emerald-200 uppercase tracking-wider text-[11px] pb-2 border-b border-[#1c3525]">
            1. Computer Vision & Stripe Biometrics Tiers
          </h3>

          <div className="space-y-1.5">
            <div className="flex justify-between font-medium">
              <span className="text-emerald-200">Blank Foliage Quarantine Threshold</span>
              <span className="text-emerald-400 font-mono font-bold">{blankThreshold}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="95"
              value={blankThreshold}
              onChange={(e) => setBlankThreshold(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <p className="text-[11px] text-emerald-400/70">Captures exceeding this blankness confidence are moved to the Quarantine Vault with zero data loss.</p>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-[#122417]">
            <div className="flex justify-between font-medium">
              <span className="text-emerald-200">Automated Stripe Match Acceptance (Cosine Sim)</span>
              <span className="text-emerald-400 font-mono font-bold">{autoMatchThreshold}%</span>
            </div>
            <input
              type="range"
              min="70"
              max="95"
              value={autoMatchThreshold}
              onChange={(e) => setAutoMatchThreshold(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <p className="text-[11px] text-emerald-400/70">Cosine stripe vector similarity required for zero-touch auto assignment on compatible flanks.</p>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-[#122417]">
            <div className="flex justify-between font-medium">
              <span className="text-emerald-200">Ambiguous Review Studio Floor</span>
              <span className="text-amber-400 font-mono font-bold">{ambiguousLower}%</span>
            </div>
            <input
              type="range"
              min="30"
              max="70"
              value={ambiguousLower}
              onChange={(e) => setAmbiguousLower(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
            <p className="text-[11px] text-emerald-400/70">Matches between {ambiguousLower}% and {autoMatchThreshold}% are routed to the Biologist Review Studio.</p>
          </div>
        </div>

        {/* Ecological Deviation Policies */}
        <div className="field-card p-4 space-y-4">
          <h3 className="font-bold text-emerald-200 uppercase tracking-wider text-[11px] pb-2 border-b border-[#1c3525]">
            2. Ecological Spatial & Movement Deviation Rules
          </h3>

          <div className="space-y-1.5">
            <div className="flex justify-between font-medium">
              <span className="text-emerald-200">Buffer Zone Movement Incursion Trigger</span>
              <span className="text-rose-400 font-mono font-bold">{bufferMovementKm.toFixed(1)} km</span>
            </div>
            <input
              type="range"
              min="2.0"
              max="10.0"
              step="0.5"
              value={bufferMovementKm}
              onChange={(e) => setBufferMovementKm(Number(e.target.value))}
              className="w-full accent-rose-500"
            />
            <p className="text-[11px] text-emerald-400/70">Generates buffer territory expansion alert when a tiger travels &gt; 5.0 km across buffer traps.</p>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-[#122417]">
            <div className="flex justify-between font-medium">
              <span className="text-emerald-200">Core Sanctuary Centroid Shift Trigger</span>
              <span className="text-rose-400 font-mono font-bold">{coreShiftKm.toFixed(1)} km</span>
            </div>
            <input
              type="range"
              min="2.0"
              max="8.0"
              step="0.5"
              value={coreShiftKm}
              onChange={(e) => setCoreShiftKm(Number(e.target.value))}
              className="w-full accent-rose-500"
            />
            <p className="text-[11px] text-emerald-400/70">Reflects 15–20 sq km core territory baseline radius (deviation beyond normal home range).</p>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-[#122417]">
            <div className="flex justify-between font-medium">
              <span className="text-emerald-200">Village Proximity Conflict Boundary</span>
              <span className="text-rose-400 font-mono font-bold">{villageDistanceKm.toFixed(1)} km</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="3.0"
              step="0.1"
              value={villageDistanceKm}
              onChange={(e) => setVillageDistanceKm(Number(e.target.value))}
              className="w-full accent-rose-500"
            />
            <p className="text-[11px] text-emerald-400/70">Triggers critical human-wildlife interface alert when a tiger approaches within 1.5 km of a village.</p>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-[#122417]">
            <div className="flex justify-between font-medium">
              <span className="text-emerald-200">Minimum Sightings for MCP 95% Home Range</span>
              <span className="text-emerald-400 font-mono font-bold">{minObservationsMCP} sightings</span>
            </div>
            <input
              type="range"
              min="3"
              max="15"
              value={minObservationsMCP}
              onChange={(e) => setMinObservationsMCP(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <p className="text-[11px] text-emerald-400/70">Minimum distinct captures required before generating a statistically valid convex hull polygon.</p>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-[#122417]">
            <div className="flex justify-between font-medium">
              <span className="text-emerald-200">Prolonged Resident Absence Window</span>
              <span className="text-amber-400 font-mono font-bold">{absenceDays} days</span>
            </div>
            <input
              type="range"
              min="15"
              max="90"
              value={absenceDays}
              onChange={(e) => setAbsenceDays(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
            <p className="text-[11px] text-emerald-400/70">Flags resident tigers undetected across active trap-nights beyond NTCA 45-day survey window.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
