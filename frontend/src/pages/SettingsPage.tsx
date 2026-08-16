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
    <div className="p-4 space-y-4 max-w-[1400px] mx-auto text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#232834]">
        <div>
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
            <SlidersHorizontal className="w-4 h-4 text-slate-400" />
            <span>Threshold Policies & Calibration Parameters</span>
          </h2>
          <p className="text-[11px] text-slate-400">
            Configure machine learning classification confidence, stripe re-identification thresholds, and spatial deviation alert parameters.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunLiveBenchmark}
            disabled={isRunningBench}
            className="px-3 py-1 bg-[#181d26] hover:bg-[#232834] text-slate-200 rounded border border-[#2a3140] transition flex items-center gap-1.5 text-xs"
          >
            <Cpu className="w-3.5 h-3.5 text-slate-400" />
            <span>{isRunningBench ? 'Benchmarking Hardware...' : 'Run Hardware Benchmark'}</span>
          </button>

          <button
            onClick={handleSave}
            className="px-3.5 py-1 bg-[#1a2e20] hover:bg-[#26452f] text-emerald-300 font-medium rounded border border-[#26452f] transition flex items-center gap-1.5 text-xs"
          >
            {saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            <span>{saved ? 'Saved' : 'Save Policies'}</span>
          </button>
        </div>
      </div>

      {/* Live Benchmark Result Panel */}
      {benchmarkResult && (
        <div className="field-card p-3.5 space-y-2 border-[#313848]">
          <div className="flex items-center justify-between pb-1.5 border-b border-[#232834]">
            <div className="flex items-center gap-1.5 font-semibold text-slate-200 text-xs">
              <Cpu className="w-4 h-4 text-slate-400" />
              <span>Hardware Benchmark Results</span>
            </div>
            <span className="font-mono text-[11px] text-slate-400">{benchmarkResult.device}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-[#11141a] p-2 rounded border border-[#232834]">
              <span className="text-slate-400 text-[10px]">Total Latency</span>
              <div className="text-sm font-semibold text-slate-100 font-mono mt-0.5">
                {benchmarkResult.stages_latency_ms.total_pipeline_avg_ms} ms
              </div>
            </div>
            <div className="bg-[#11141a] p-2 rounded border border-[#232834]">
              <span className="text-slate-400 text-[10px]">Processing Speed</span>
              <div className="text-sm font-semibold text-emerald-400 font-mono mt-0.5">
                {benchmarkResult.throughput.images_per_minute} img/min
              </div>
            </div>
            <div className="bg-[#11141a] p-2 rounded border border-[#232834]">
              <span className="text-slate-400 text-[10px]">RAM Footprint</span>
              <div className="text-sm font-semibold text-slate-100 font-mono mt-0.5">
                {benchmarkResult.memory_usage_mb} MB
              </div>
            </div>
            <div className="bg-[#11141a] p-2 rounded border border-[#232834]">
              <span className="text-amber-400 text-[10px]">10K SD Card Time</span>
              <div className="text-sm font-semibold text-amber-300 font-mono mt-0.5">
                {benchmarkResult.throughput['10k_sd_card_triage_estimate_minutes']} min
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* ML Triage & Bilateral Flank Policies */}
        <div className="field-card p-3.5 space-y-3.5">
          <span className="font-semibold text-slate-200 text-xs block pb-1.5 border-b border-[#232834]">
            1. Computer Vision & Stripe Biometrics Tiers
          </span>

          <div className="space-y-1">
            <div className="flex justify-between font-medium">
              <span className="text-slate-300">Blank Foliage Quarantine Threshold</span>
              <span className="text-emerald-400 font-mono">{blankThreshold}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="95"
              value={blankThreshold}
              onChange={(e) => setBlankThreshold(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <p className="text-[11px] text-slate-400">Captures exceeding this blankness confidence are moved to the Quarantine Vault.</p>
          </div>

          <div className="space-y-1 pt-2 border-t border-[#1e232d]">
            <div className="flex justify-between font-medium">
              <span className="text-slate-300">Automated Stripe Match Acceptance (Cosine Sim)</span>
              <span className="text-emerald-400 font-mono">{autoMatchThreshold}%</span>
            </div>
            <input
              type="range"
              min="70"
              max="95"
              value={autoMatchThreshold}
              onChange={(e) => setAutoMatchThreshold(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <p className="text-[11px] text-slate-400">Cosine stripe vector similarity required for zero-touch auto assignment on compatible flanks.</p>
          </div>

          <div className="space-y-1 pt-2 border-t border-[#1e232d]">
            <div className="flex justify-between font-medium">
              <span className="text-slate-300">Ambiguous Review Studio Floor</span>
              <span className="text-amber-400 font-mono">{ambiguousLower}%</span>
            </div>
            <input
              type="range"
              min="30"
              max="70"
              value={ambiguousLower}
              onChange={(e) => setAmbiguousLower(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
            <p className="text-[11px] text-slate-400">Matches between {ambiguousLower}% and {autoMatchThreshold}% are routed to the Biologist Review Studio.</p>
          </div>
        </div>

        {/* Ecological Deviation Policies */}
        <div className="field-card p-3.5 space-y-3.5">
          <span className="font-semibold text-slate-200 text-xs block pb-1.5 border-b border-[#232834]">
            2. Ecological Spatial & Movement Deviation Rules
          </span>

          <div className="space-y-1">
            <div className="flex justify-between font-medium">
              <span className="text-slate-300">Buffer Zone Movement Incursion Trigger</span>
              <span className="text-rose-400 font-mono">{bufferMovementKm.toFixed(1)} km</span>
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
            <p className="text-[11px] text-slate-400">Generates buffer territory expansion alert when a tiger travels &gt; 5.0 km across buffer traps.</p>
          </div>

          <div className="space-y-1 pt-2 border-t border-[#1e232d]">
            <div className="flex justify-between font-medium">
              <span className="text-slate-300">Core Sanctuary Centroid Shift Trigger</span>
              <span className="text-rose-400 font-mono">{coreShiftKm.toFixed(1)} km</span>
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
            <p className="text-[11px] text-slate-400">Reflects 15–20 sq km core territory baseline radius.</p>
          </div>

          <div className="space-y-1 pt-2 border-t border-[#1e232d]">
            <div className="flex justify-between font-medium">
              <span className="text-slate-300">Village Proximity Conflict Boundary</span>
              <span className="text-rose-400 font-mono">{villageDistanceKm.toFixed(1)} km</span>
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
            <p className="text-[11px] text-slate-400">Triggers critical alert when a tiger approaches within 1.5 km of a village boundary.</p>
          </div>

          <div className="space-y-1 pt-2 border-t border-[#1e232d]">
            <div className="flex justify-between font-medium">
              <span className="text-slate-300">Minimum Sightings for MCP 95% Home Range</span>
              <span className="text-emerald-400 font-mono">{minObservationsMCP} sightings</span>
            </div>
            <input
              type="range"
              min="3"
              max="15"
              value={minObservationsMCP}
              onChange={(e) => setMinObservationsMCP(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <p className="text-[11px] text-slate-400">Minimum distinct captures required before generating a statistically valid convex hull polygon.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
