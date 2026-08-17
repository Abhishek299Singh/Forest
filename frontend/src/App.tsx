import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SyncProvider } from './context/SyncContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { ShieldAlert, Loader2, Trees } from 'lucide-react';

// Pages
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { IngestionPage } from './pages/IngestionPage';
import { CataloguePage } from './pages/CataloguePage';
import { ReviewPage } from './pages/ReviewPage';
import { MapPage } from './pages/MapPage';
import { AlertsPage } from './pages/AlertsPage';
import { StationsPage } from './pages/StationsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SyncPage } from './pages/SyncPage';
import { SettingsPage } from './pages/SettingsPage';
import { UsersPage } from './pages/UsersPage';

function AppContent() {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mapFocus, setMapFocus] = useState<{ lat?: number; lon?: number; station?: string } | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0d1015] flex flex-col items-center justify-center text-slate-300 font-mono text-xs gap-3 select-none">
        <div className="w-10 h-10 rounded-lg bg-[#181d26] border border-[#2a3140] flex items-center justify-center text-emerald-400 font-bold shadow-inner">
          <Trees className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
          <span>Initializing Pench Field Terminal...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const handleNavigateToMap = (params?: { lat?: number; lon?: number; station?: string }) => {
    if (params) setMapFocus(params);
    setActiveTab('map');
  };

  const isAdmin = user?.role === 'admin';
  const adminOnlyTabs = ['users', 'reports', 'sync', 'settings'];

  const renderContent = () => {
    if (!isAdmin && adminOnlyTabs.includes(activeTab)) {
      return (
        <div className="p-8 max-w-xl mx-auto text-center space-y-4 my-12 bg-[#141820] border border-[#2e3544] rounded-lg shadow-xl">
          <div className="w-12 h-12 rounded-full bg-rose-950/80 border border-rose-800 text-rose-300 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-base font-semibold text-slate-100">Access Denied: Administrator Privileges Required</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            This module is restricted to the Field Director (Admin). Ranger accounts are authorized for Field Operations, SD Card Ingestion, Tiger Catalogue, GIS Mapping, and Movement Alerts.
          </p>
          <button
            onClick={() => setActiveTab('dashboard')}
            className="px-4 py-1.5 bg-[#181d26] hover:bg-[#232834] text-slate-200 rounded border border-[#2a3140] text-xs font-medium transition"
          >
            Return to Command Overview
          </button>
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage onNavigate={(tab: string) => setActiveTab(tab)} />;
      case 'ingestion':
        return <IngestionPage onNavigateToMap={handleNavigateToMap} />;
      case 'catalogue':
        return <CataloguePage />;
      case 'review':
        return <ReviewPage />;
      case 'map':
        return <MapPage initialFocus={mapFocus} />;
      case 'alerts':
        return <AlertsPage />;
      case 'stations':
        return <StationsPage />;
      case 'users':
        return <UsersPage />;
      case 'reports':
        return <ReportsPage />;
      case 'sync':
        return <SyncPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage onNavigate={(tab: string) => setActiveTab(tab)} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1015] text-[#e1e4e8] flex flex-col font-sans select-none">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="flex-1 overflow-y-auto bg-[#0d1015]">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <SyncProvider>
        <WebSocketProvider>
          <AppContent />
        </WebSocketProvider>
      </SyncProvider>
    </AuthProvider>
  );
}

export default App;
