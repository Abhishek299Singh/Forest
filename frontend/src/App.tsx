import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { SyncProvider } from './context/SyncContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';

// Pages
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

export function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage onNavigate={(tab: string) => setActiveTab(tab)} />;
      case 'ingestion':
        return <IngestionPage />;
      case 'catalogue':
        return <CataloguePage />;
      case 'review':
        return <ReviewPage />;
      case 'map':
        return <MapPage />;
      case 'alerts':
        return <AlertsPage />;
      case 'stations':
        return <StationsPage />;
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
    <AuthProvider>
      <SyncProvider>
        <WebSocketProvider>
          <div className="min-h-screen bg-[#0d1015] text-[#e1e4e8] flex flex-col font-sans select-none">
            <Header />
            <div className="flex flex-1 overflow-hidden">
              <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
              <main className="flex-1 overflow-y-auto bg-[#0d1015]">
                {renderContent()}
              </main>
            </div>
          </div>
        </WebSocketProvider>
      </SyncProvider>
    </AuthProvider>
  );
}

export default App;
