import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SyncStatus } from '../types';
import { ApiClient } from '../api/client';

interface SyncContextType {
  status: SyncStatus;
  refreshStatus: () => Promise<void>;
  toggleConnectivity: (online: boolean) => Promise<void>;
  triggerSyncNow: () => Promise<void>;
}

const defaultStatus: SyncStatus = {
  is_online: false,
  sync_status: 'offline',
  device_id: 'PENCH-FIELD-LAPTOP-01',
  last_synced_at: new Date().toISOString(),
  pending_uploads: 0,
  pending_downloads: 0,
  failed_count: 0,
};

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<SyncStatus>(defaultStatus);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await ApiClient.getSyncStatus();
      setStatus(s);
    } catch (_) {}
  }, []);

  const toggleConnectivity = async (online: boolean) => {
    try {
      const s = await ApiClient.toggleConnectivity(online);
      setStatus(s);
    } catch (_) {}
  };

  const triggerSyncNow = async () => {
    try {
      setStatus(prev => ({ ...prev, sync_status: 'syncing' }));
      const s = await ApiClient.triggerSync();
      setStatus(s);
    } catch (_) {
      setStatus(prev => ({ ...prev, sync_status: 'error', failed_count: prev.failed_count + 1 }));
    }
  };

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 8000);
    return () => clearInterval(interval);
  }, [refreshStatus]);

  return (
    <SyncContext.Provider value={{ status, refreshStatus, toggleConnectivity, triggerSyncNow }}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) throw new Error('useSync must be used within a SyncProvider');
  return context;
};
