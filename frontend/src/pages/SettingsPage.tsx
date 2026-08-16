import React, { useState } from 'react';
import { SlidersHorizontal, Save, Check } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [blankThreshold, setBlankThreshold] = useState(70);
  const [autoMatchThreshold, setAutoMatchThreshold] = useState(85);
  const [ambiguousLower, setAmbiguousLower] = useState(50);
  const [centroidShiftKm, setCentroidShiftKm] = useState(4.0);
  const [villageDistanceKm, setVillageDistanceKm] = useState(1.5);
  const [absenceDays, setAbsenceDays] = useState(45);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="p-5 space-y-5 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#233044]">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-emerald-400" />
            <span>AI Triage & Ecological Movement Threshold Policies</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure decision thresholds for automated blank image quarantine, stripe re-identification tiers, and territorial alert triggers.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="px-4 py-2 bg-[#1b3d2b] hover:bg-[#234e37] text-emerald-200 text-xs font-semibold rounded border border-[#2d6144] transition flex items-center gap-2"
        >
          {saved ? <Check className="w-4 h-4 text-emerald-400" /> : <Save className="w-4 h-4" />}
          <span>{saved ? 'Policies Updated' : 'Save Policies'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
        {/* CV Triage Policy */}
        <div className="field-card p-4 space-y-4">
          <h3 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] pb-2 border-b border-[#233044]">
            Computer Vision Triage & Identification
          </h3>

          <div className="space-y-1.5">
            <div className="flex justify-between font-medium">
              <span className="text-slate-300">Blank Image Quarantine Threshold</span>
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
            <p className="text-[11px] text-slate-400">Captures exceeding this blankness confidence are moved to Quarantine Vault.</p>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-[#1a2537]">
            <div className="flex justify-between font-medium">
              <span className="text-slate-300">Automated Stripe Match Acceptance</span>
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
            <p className="text-[11px] text-slate-400">Cosine stripe vector similarity required for zero-touch auto assignment.</p>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-[#1a2537]">
            <div className="flex justify-between font-medium">
              <span className="text-slate-300">Ambiguous Review Floor</span>
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
            <p className="text-[11px] text-slate-400">Matches between {ambiguousLower}% and {autoMatchThreshold}% are routed to the Biologist Review Studio.</p>
          </div>
        </div>

        {/* Ecological Deviation Policy */}
        <div className="field-card p-4 space-y-4">
          <h3 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] pb-2 border-b border-[#233044]">
            Ecological Movement & Spatial Alerts
          </h3>

          <div className="space-y-1.5">
            <div className="flex justify-between font-medium">
              <span className="text-slate-300">Territory Centroid Shift Trigger</span>
              <span className="text-rose-400 font-mono font-bold">{centroidShiftKm.toFixed(1)} km</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="10.0"
              step="0.5"
              value={centroidShiftKm}
              onChange={(e) => setCentroidShiftKm(Number(e.target.value))}
              className="w-full accent-rose-500"
            />
            <p className="text-[11px] text-slate-400">Generates alert if a sighting exceeds this distance from the tiger's historical centroid.</p>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-[#1a2537]">
            <div className="flex justify-between font-medium">
              <span className="text-slate-300">Village Proximity Incursion Limit</span>
              <span className="text-rose-400 font-mono font-bold">{villageDistanceKm.toFixed(1)} km</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.1"
              value={villageDistanceKm}
              onChange={(e) => setVillageDistanceKm(Number(e.target.value))}
              className="w-full accent-rose-500"
            />
            <p className="text-[11px] text-slate-400">Triggers critical human-wildlife conflict alert when a tiger approaches a village boundary.</p>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-[#1a2537]">
            <div className="flex justify-between font-medium">
              <span className="text-slate-300">Prolonged Resident Absence Window</span>
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
            <p className="text-[11px] text-slate-400">Flags resident tigers undetected across active trap-nights beyond this threshold.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
