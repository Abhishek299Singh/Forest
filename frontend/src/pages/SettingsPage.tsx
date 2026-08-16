import React, { useState } from 'react';
import { Sliders, Shield, Save, CheckCircle2, RotateCcw, AlertTriangle, Users } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  // Threshold Settings
  const [blankThreshold, setBlankThreshold] = useState(70);
  const [tigerAutoMatch, setTigerAutoMatch] = useState(85);
  const [tigerAmbiguous, setTigerAmbiguous] = useState(50);
  const [centroidShiftKm, setCentroidShiftKm] = useState(4.0);
  const [bufferDistanceKm, setBufferDistanceKm] = useState(3.5);
  const [villageProximityKm, setVillageProximityKm] = useState(1.5);
  const [absenceDays, setAbsenceDays] = useState(45);
  const [surveyEffortDays, setSurveyEffortDays] = useState(14);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleReset = () => {
    setBlankThreshold(70);
    setTigerAutoMatch(85);
    setTigerAmbiguous(50);
    setCentroidShiftKm(4.0);
    setBufferDistanceKm(3.5);
    setVillageProximityKm(1.5);
    setAbsenceDays(45);
    setSurveyEffortDays(14);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <Sliders className="w-6 h-6 text-emerald-400" />
            <span>Policy Thresholds & Reserve Configuration</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure automated triage confidence thresholds, movement deviation triggers, and survey effort rules.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 border border-slate-700"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-emerald-950"
          >
            <Save className="w-4 h-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="bg-emerald-950/80 border border-emerald-500/50 p-3.5 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Configuration policy updated and applied to local offline engine.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: AI Model Confidence Thresholds */}
        <div className="glass-panel p-6 rounded-2xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide">
              AI Triage & Stripe Match Thresholds
            </h3>
            <span className="text-[10px] text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded">Modular ML v2.1</span>
          </div>

          {/* Blank Image Quarantine Threshold */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Blank Image Quarantine Threshold</span>
              <span className="font-mono font-bold text-amber-400">{blankThreshold}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="95"
              value={blankThreshold}
              onChange={(e) => setBlankThreshold(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <p className="text-[11px] text-slate-400">
              Captures with blank confidence &ge; {blankThreshold}% are automatically quarantined. Below this, images go to Human Review.
            </p>
          </div>

          {/* Tiger Stripe Auto-Match Threshold */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Tiger Identification Auto-Accept Threshold</span>
              <span className="font-mono font-bold text-emerald-400">{tigerAutoMatch}%</span>
            </div>
            <input
              type="range"
              min="70"
              max="98"
              value={tigerAutoMatch}
              onChange={(e) => setTigerAutoMatch(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <p className="text-[11px] text-slate-400">
              Cosine vector similarity &ge; {tigerAutoMatch}% is accepted without manual intervention.
            </p>
          </div>

          {/* Ambiguous Match Lower Threshold */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Ambiguous Review Queue Lower Bound</span>
              <span className="font-mono font-bold text-purple-400">{tigerAmbiguous}%</span>
            </div>
            <input
              type="range"
              min="30"
              max="70"
              value={tigerAmbiguous}
              onChange={(e) => setTigerAmbiguous(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <p className="text-[11px] text-slate-400">
              Scores between {tigerAmbiguous}% and {tigerAutoMatch}% are flagged for human review. Below {tigerAmbiguous}% auto-enrolls as provisional individual.
            </p>
          </div>
        </div>

        {/* Section 2: Ecological Movement & Alert Engine Policy */}
        <div className="glass-panel p-6 rounded-2xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide">
              Ecological Deviation & Alert Policy
            </h3>
            <span className="text-[10px] text-purple-400 bg-purple-950 px-2 py-0.5 rounded">Pench Policy</span>
          </div>

          {/* Centroid Shift Distance */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Territory Centroid Shift Threshold</span>
              <span className="font-mono font-bold text-emerald-400">{centroidShiftKm} km (~18 km²)</span>
            </div>
            <input
              type="range"
              min="2.0"
              max="10.0"
              step="0.5"
              value={centroidShiftKm}
              onChange={(e) => setCentroidShiftKm(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <p className="text-[11px] text-slate-400">
              Triggers a high-priority movement alert if a resident tiger is captured beyond {centroidShiftKm} km of historical territory center.
            </p>
          </div>

          {/* Village Proximity Threshold */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Village Boundary Conflict Threshold</span>
              <span className="font-mono font-bold text-rose-400">{villageProximityKm} km</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.1"
              value={villageProximityKm}
              onChange={(e) => setVillageProximityKm(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <p className="text-[11px] text-slate-400">
              Captures within {villageProximityKm} km of human habitation trigger immediate CRITICAL patrol alerts.
            </p>
          </div>

          {/* Survey Effort Minimum Baseline */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Survey Effort Baseline Minimum</span>
              <span className="font-mono font-bold text-blue-400">{surveyEffortDays} Days</span>
            </div>
            <input
              type="range"
              min="7"
              max="30"
              value={surveyEffortDays}
              onChange={(e) => setSurveyEffortDays(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <p className="text-[11px] text-slate-400">
              Cameras installed less than {surveyEffortDays} days ago are flagged as effort artifacts to avoid false movement alerts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
