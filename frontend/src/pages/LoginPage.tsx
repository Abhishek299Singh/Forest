import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Trees, ShieldCheck, Eye, EyeOff, Loader2, Lock, Mail, AlertCircle, Cpu, Radio, MapPin } from 'lucide-react';
import heroImage from '../assets/hero.png';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    if (!email.trim()) {
      setError('Please enter your email address.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address.');
      return false;
    }
    if (!password) {
      setError('Please enter your password.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      const msg = err?.message || 'Invalid email or password.';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('network')) {
        setError('Unable to connect to the authentication service. Please check network connection.');
      } else {
        setError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickFill = (fillEmail: string, fillPass: string) => {
    setEmail(fillEmail);
    setPassword(fillPass);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#0d1015] text-[#e1e4e8] flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans select-none">
      <div className="w-full max-w-5xl bg-[#11141a] border border-[#232834] rounded-xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">
        
        {/* LEFT COLUMN — BRAND & VISUAL IDENTITY (Desktop 7 cols, hidden/stacked on mobile) */}
        <div className="lg:col-span-7 bg-[#141820] border-b lg:border-b-0 lg:border-r border-[#232834] p-6 sm:p-8 lg:p-10 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle Ambient Forest Glow Background */}
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-950/30 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-900/20 rounded-full blur-3xl pointer-events-none" />

          {/* Header & Department Branding */}
          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#181d26] border border-[#2a3140] flex items-center justify-center text-emerald-400 font-bold shadow-inner">
                <Trees className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-100 text-sm tracking-tight">
                    Pench Tiger Reserve
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 bg-[#181d26] px-2 py-0.5 rounded border border-[#2a3140]">
                    MP Forest Dept
                  </span>
                </div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  Madhya Pradesh • India
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight leading-snug">
                Pench Wildlife Intelligence Platform
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-normal">
                Secure Field Intelligence Access & Strategic Camera Trap Monitoring Grid
              </p>
            </div>
          </div>

          {/* Center Visual Asset — Hero Preview */}
          <div className="relative z-10 my-6 sm:my-8 group">
            <div className="relative rounded-lg overflow-hidden border border-[#2e3544] bg-[#0d1015] shadow-xl">
              <img 
                src={heroImage} 
                alt="Pench Wildlife Intelligence Field Operations"
                className="w-full h-48 sm:h-56 object-cover object-center opacity-85 group-hover:opacity-100 transition duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#141820] via-transparent to-transparent opacity-90" />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono text-slate-300">
                <div className="flex items-center gap-1.5 bg-[#0d1015]/80 px-2.5 py-1 rounded border border-[#2a3140] backdrop-blur-sm">
                  <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                  <span>NTCA Phase-IV Grid Active</span>
                </div>
                <div className="flex items-center gap-1 bg-[#0d1015]/80 px-2 py-1 rounded border border-[#2a3140] backdrop-blur-sm text-slate-400">
                  <MapPin className="w-3 h-3 text-amber-400" />
                  <span>Turia • Karmajhiri</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Operational Badges */}
          <div className="relative z-10 grid grid-cols-3 gap-2 pt-4 border-t border-[#232834] text-[11px] font-mono">
            <div className="bg-[#181d26]/80 border border-[#2a3140] p-2 rounded text-center">
              <div className="text-emerald-400 font-bold">128</div>
              <div className="text-[10px] text-slate-400">Trap Stations</div>
            </div>
            <div className="bg-[#181d26]/80 border border-[#2a3140] p-2 rounded text-center">
              <div className="text-amber-400 font-bold">AI Stripe</div>
              <div className="text-[10px] text-slate-400">Re-ID Engine</div>
            </div>
            <div className="bg-[#181d26]/80 border border-[#2a3140] p-2 rounded text-center">
              <div className="text-slate-200 font-bold">SQLite / GIS</div>
              <div className="text-[10px] text-slate-400">Field Sync</div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN — AUTHENTICATION FORM (Desktop 5 cols) */}
        <div className="lg:col-span-5 p-6 sm:p-8 lg:p-10 flex flex-col justify-between bg-[#11141a]">
          <div>
            {/* Form Header */}
            <div className="space-y-1.5 pb-6 border-b border-[#232834]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-semibold text-slate-100 tracking-tight">
                  Field Terminal Sign In
                </h2>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed font-mono">
                Enter your authorized credentials to access camera trap telemetry & field operations.
              </p>
            </div>

            {/* Error Notification Banner */}
            {error && (
              <div 
                role="alert" 
                aria-live="polite"
                className="mt-4 p-3 bg-rose-950/80 border border-rose-800/80 rounded-lg text-rose-200 text-xs flex items-start gap-2.5 shadow-md"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="leading-snug">{error}</div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
              {/* Email Address Input */}
              <div className="space-y-1.5">
                <label 
                  htmlFor="login-email" 
                  className="block text-xs font-mono font-medium text-slate-300 uppercase tracking-wider"
                >
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="login-email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    disabled={isSubmitting}
                    className="w-full bg-[#181d26] border border-[#2a3140] text-slate-100 rounded-lg pl-9 pr-3 py-2 text-xs font-mono focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition disabled:opacity-50 placeholder:text-slate-500"
                  />
                </div>
              </div>

              {/* Password Input with Show/Hide Toggle */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label 
                    htmlFor="login-password" 
                    className="block text-xs font-mono font-medium text-slate-300 uppercase tracking-wider"
                  >
                    Password
                  </label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    disabled={isSubmitting}
                    className="w-full bg-[#181d26] border border-[#2a3140] text-slate-100 rounded-lg pl-9 pr-10 py-2 text-xs font-mono focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition disabled:opacity-50 placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isSubmitting}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition focus:outline-none focus:text-emerald-400 disabled:opacity-50"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white font-medium text-xs py-2.5 px-4 rounded-lg border border-emerald-600/50 shadow-lg hover:shadow-emerald-900/30 transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed font-mono uppercase tracking-wider"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-200" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Quick Fill Credentials for Field Testing */}
            <div className="mt-6 pt-5 border-t border-[#232834] space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span className="uppercase tracking-wider">Field Session Quick Presets:</span>
                <span className="text-emerald-400/80">Local / Offline Supported</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => handleQuickFill('admin@pench.gov.in', 'pench123')}
                  className="px-2.5 py-1.5 bg-[#181d26] hover:bg-[#232834] text-slate-300 hover:text-amber-300 rounded border border-[#2a3140] hover:border-amber-800/80 transition text-left flex flex-col"
                >
                  <span className="font-semibold text-amber-400">ADMIN (Director)</span>
                  <span className="text-[9px] text-slate-400 truncate">admin@pench.gov.in</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('ranger@pench.gov.in', 'pench123')}
                  className="px-2.5 py-1.5 bg-[#181d26] hover:bg-[#232834] text-slate-300 hover:text-emerald-300 rounded border border-[#2a3140] hover:border-emerald-800/80 transition text-left flex flex-col"
                >
                  <span className="font-semibold text-emerald-400">RANGER (Field)</span>
                  <span className="text-[9px] text-slate-400 truncate">ranger@pench.gov.in</span>
                </button>
              </div>
            </div>
          </div>

          {/* Footer Security Notice */}
          <div className="mt-6 pt-4 border-t border-[#232834] text-[10px] font-mono text-slate-400 text-center flex items-center justify-center gap-1.5">
            <Cpu className="w-3 h-3 text-slate-400" />
            <span>Encrypted Session • Pench Forest Department Security Protocol</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default LoginPage;
