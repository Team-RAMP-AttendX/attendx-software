'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useSyncExternalStore } from 'react';
import { User, Device, AttendanceRecord, PINImage } from '@/types';
import { createInitialSimulationState, SimulationState } from '@/lib/simulationStore';

interface SystemModeContextType {
  // Hydration state
  isHydrated: boolean;

  // Auth state
  isAuthenticated: boolean;
  adminEmail: string;
  login: (email: string, sessionToken: string) => void;
  logout: () => void;

  // Mode state
  isSimulationMode: boolean;
  toggleSimulationMode: () => void;
  setSimulationMode: (val: boolean) => void;

  // Simulation Data (Zero DB read/write)
  simState: SimulationState;
  triggerSimulatedCheckIn: (userId: string, mode?: 'fingerprint' | 'pin') => void;
  triggerSimulatedEnrollment: (userId: string, targetSlot?: number) => void;
  triggerSimulatedHeartbeat: (deviceId: string) => void;
  toggleSimulatedDeviceWifi: (deviceId: string) => void;
  syncSimulatedDevice: (deviceId: string) => void;
  rebootSimulatedDevice: (deviceId: string) => void;
  deleteSimulatedDevice: (deviceId: string) => void;
  addSimulatedDevice: (device: Device) => void;
  resetSimulationData: () => void;

  // Real Database Reset
  resetDatabase: () => Promise<{ success: boolean; message: string }>;
  isResettingDb: boolean;
}

interface StoredAuth {
  isAuthenticated: boolean;
  adminEmail: string;
  isSimulationMode: boolean;
}

const emptyState: StoredAuth = {
  isAuthenticated: false,
  adminEmail: process.env.NEXT_PUBLIC_MASTER_ADMIN_EMAIL || 'admin@example.com',
  isSimulationMode: false,
};

let cachedState: StoredAuth = emptyState;
const listeners = new Set<() => void>();

function syncFromStorage(): StoredAuth {
  if (typeof window === 'undefined') return emptyState;
  try {
    const authRaw = localStorage.getItem('attendx_admin_auth');
    let isAuth = false;
    let email = process.env.NEXT_PUBLIC_MASTER_ADMIN_EMAIL || 'admin@example.com';
    if (authRaw) {
      const parsed = JSON.parse(authRaw);
      if (parsed?.email && parsed?.sessionToken) {
        isAuth = true;
        email = parsed.email;
      }
    }
    const simRaw = localStorage.getItem('attendx_simulation_mode');
    const isSim = simRaw === 'true';

    if (
      cachedState.isAuthenticated === isAuth &&
      cachedState.adminEmail === email &&
      cachedState.isSimulationMode === isSim
    ) {
      return cachedState;
    }

    cachedState = {
      isAuthenticated: isAuth,
      adminEmail: email,
      isSimulationMode: isSim,
    };
    return cachedState;
  } catch {
    return cachedState;
  }
}

// Initial read on client
if (typeof window !== 'undefined') {
  syncFromStorage();
}

const authStore = {
  getSnapshot(): StoredAuth {
    if (typeof window !== 'undefined') {
      return syncFromStorage();
    }
    return emptyState;
  },
  getServerSnapshot(): StoredAuth {
    return emptyState;
  },
  subscribe(callback: () => void) {
    listeners.add(callback);
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'attendx_admin_auth' || e.key === 'attendx_simulation_mode') {
        syncFromStorage();
        callback();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      listeners.delete(callback);
      window.removeEventListener('storage', handleStorage);
    };
  },
  setAuth(isAuth: boolean, email: string) {
    if (typeof window !== 'undefined') {
      if (isAuth) {
        localStorage.setItem(
          'attendx_admin_auth',
          JSON.stringify({ email, sessionToken: `sess_${Date.now()}` })
        );
      } else {
        localStorage.removeItem('attendx_admin_auth');
      }
      syncFromStorage();
      listeners.forEach((l) => l());
    }
  },
  setSimulationMode(val: boolean) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('attendx_simulation_mode', val ? 'true' : 'false');
      syncFromStorage();
      listeners.forEach((l) => l());
    }
  },
};

const SystemModeContext = createContext<SystemModeContextType | null>(null);

export function SystemModeProvider({ children }: { children: React.ReactNode }) {
  const authData = useSyncExternalStore(
    authStore.subscribe,
    authStore.getSnapshot,
    authStore.getServerSnapshot
  );

  const [isHydrated, setIsHydrated] = useState(false);
  const [simState, setSimState] = useState<SimulationState>(() => createInitialSimulationState());
  const [isResettingDb, setIsResettingDb] = useState(false);

  React.useEffect(() => {
    setIsHydrated(true);
  }, []);

  const login = useCallback((email: string, _sessionToken?: string) => {
    authStore.setAuth(true, email);
  }, []);

  const logout = useCallback(() => {
    authStore.setAuth(false, process.env.NEXT_PUBLIC_MASTER_ADMIN_EMAIL || 'admin@example.com');
    setSimState(createInitialSimulationState());
  }, []);

  const setSimulationMode = useCallback((val: boolean) => {
    if (!val && authData.adminEmail === 'simulation_guest@attendx.local') {
      logout();
    } else {
      authStore.setSimulationMode(val);
    }
  }, [authData.adminEmail, logout]);

  const toggleSimulationMode = useCallback(() => {
    if (authData.isSimulationMode && authData.adminEmail === 'simulation_guest@attendx.local') {
      logout();
    } else {
      authStore.setSimulationMode(!authData.isSimulationMode);
    }
  }, [authData.isSimulationMode, authData.adminEmail, logout]);

  const resetSimulationData = useCallback(() => {
    setSimState(createInitialSimulationState());
  }, []);

  // Simulation Triggers (Zero DB interaction)
  const triggerSimulatedCheckIn = useCallback((userId: string, mode: 'fingerprint' | 'pin' = 'fingerprint') => {
    setSimState(prev => {
      const user = prev.users.find(u => u.id === userId);
      if (!user) return prev;

      const now = new Date();
      const isLate = now.getHours() >= 9 && now.getMinutes() > 0;
      const newRecord: AttendanceRecord = {
        id: `SIM_ATT_${Date.now()}`,
        userId,
        deviceId: 'DEV_TERM_01',
        date: now.toISOString().split('T')[0],
        checkInTime: now.toISOString(),
        checkInMode: mode,
        status: isLate ? 'Late' : 'Present',
        lateDurationMinutes: isLate ? now.getMinutes() : 0,
        syncStatus: 'Synced',
        createdAt: now.toISOString()
      };

      const updatedUsers = prev.users.map(u => {
        if (u.id === userId) {
          return {
            ...u,
            totalAttendance: u.totalAttendance + 1,
            lateOccurrences: isLate ? u.lateOccurrences + 1 : u.lateOccurrences
          };
        }
        return u;
      });

      return {
        ...prev,
        users: updatedUsers,
        attendance: [newRecord, ...prev.attendance],
        liveLogMessage: `[SIMULATION] Checked in ${user.name} via ${mode.toUpperCase()} (${isLate ? 'Late' : 'Present'})`
      };
    });
  }, []);

  const triggerSimulatedEnrollment = useCallback((userId: string, targetSlot = 1) => {
    setSimState(prev => {
      const user = prev.users.find(u => u.id === userId);
      const updatedDevices = prev.devices.map(d => {
        if (d.id === 'DEV_TERM_01') {
          const enrolled = (d.enrolledFingerprints || 0) + 1;
          const max = d.maxSlots || 300;
          return {
            ...d,
            enrolledFingerprints: enrolled,
            freeSlots: Math.max(0, max - enrolled)
          };
        }
        return d;
      });

      return {
        ...prev,
        devices: updatedDevices,
        liveLogMessage: `[SIMULATION] Enrolled fingerprint for ${user?.name || userId} into Optical Slot #${targetSlot}`
      };
    });
  }, []);

  const triggerSimulatedHeartbeat = useCallback((deviceId: string) => {
    setSimState(prev => {
      const updatedDevices = prev.devices.map(d => {
        if (d.id === deviceId) {
          const deltaRssi = Math.floor(Math.random() * 6) - 3;
          return {
            ...d,
            rssi: Math.min(-45, Math.max(-85, (d.rssi || -55) + deltaRssi)),
            lastSync: new Date().toISOString()
          };
        }
        return d;
      });
      return {
        ...prev,
        devices: updatedDevices
      };
    });
  }, []);

  const toggleSimulatedDeviceWifi = useCallback((deviceId: string) => {
    setSimState(prev => {
      const updatedDevices = prev.devices.map(d => {
        if (d.id === deviceId) {
          const isConn = d.wifiStatus === 'Connected';
          return {
            ...d,
            wifiStatus: (isConn ? 'Disconnected' : 'Connected') as 'Connected' | 'Disconnected',
            status: (isConn ? 'OFFLINE' : 'ONLINE') as 'ONLINE' | 'OFFLINE'
          };
        }
        return d;
      });
      return {
        ...prev,
        devices: updatedDevices,
        liveLogMessage: `[SIMULATION] Device ${deviceId} Wi-Fi toggled`
      };
    });
  }, []);

  const syncSimulatedDevice = useCallback((deviceId: string) => {
    setSimState(prev => {
      const updatedDevices = prev.devices.map(d => {
        if (d.id === deviceId) {
          return {
            ...d,
            pendingRecords: 0,
            lastSync: new Date().toISOString()
          };
        }
        return d;
      });
      return {
        ...prev,
        devices: updatedDevices,
        liveLogMessage: `[SIMULATION] Device ${deviceId} synchronized (0 pending records)`
      };
    });
  }, []);

  const rebootSimulatedDevice = useCallback((deviceId: string) => {
    setSimState(prev => {
      const updatedDevices = prev.devices.map(d => {
        if (d.id === deviceId) {
          return {
            ...d,
            status: 'ONLINE' as const,
            wifiStatus: 'Connected' as const,
            lastSync: new Date().toISOString(),
            esp32Heap: '298 KB Free / 520 KB Total'
          };
        }
        return d;
      });
      return {
        ...prev,
        devices: updatedDevices,
        liveLogMessage: `[SIMULATION] Device ${deviceId} soft rebooted`
      };
    });
  }, []);

  const deleteSimulatedDevice = useCallback((deviceId: string) => {
    setSimState(prev => {
      const cleanId = deviceId.trim().toUpperCase();
      return {
        ...prev,
        devices: prev.devices.filter(d => d.id !== cleanId && d.id !== deviceId),
        liveLogMessage: `[SIMULATION] Device ${cleanId} removed from terminal fleet`
      };
    });
  }, []);

  const addSimulatedDevice = useCallback((device: Device) => {
    setSimState(prev => {
      const exists = prev.devices.some(d => d.id === device.id);
      if (exists) return prev;
      return {
        ...prev,
        devices: [...prev.devices, device],
        liveLogMessage: `[SIMULATION] Device ${device.id} provisioned to terminal fleet`
      };
    });
  }, []);

  // Real Database Reset function
  const resetDatabase = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    setIsResettingDb(true);
    try {
      const res = await fetch('/api/admin/reset', { method: 'POST' });
      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        // Fallback
      }
      return {
        success: data?.success ?? true,
        message: data?.message || 'Database reset successfully to zero state.'
      };
    } catch (err: unknown) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Database reset failed.'
      };
    } finally {
      setIsResettingDb(false);
    }
  }, []);

  const contextValue = useMemo(() => ({
    isHydrated,
    isAuthenticated: authData.isAuthenticated,
    adminEmail: authData.adminEmail,
    login,
    logout,
    isSimulationMode: authData.isSimulationMode,
    toggleSimulationMode,
    setSimulationMode,
    simState,
    triggerSimulatedCheckIn,
    triggerSimulatedEnrollment,
    triggerSimulatedHeartbeat,
    toggleSimulatedDeviceWifi,
    syncSimulatedDevice,
    rebootSimulatedDevice,
    deleteSimulatedDevice,
    addSimulatedDevice,
    resetSimulationData,
    resetDatabase,
    isResettingDb
  }), [
    isHydrated,
    authData.isAuthenticated,
    authData.adminEmail,
    login,
    logout,
    authData.isSimulationMode,
    toggleSimulationMode,
    setSimulationMode,
    simState,
    triggerSimulatedCheckIn,
    triggerSimulatedEnrollment,
    triggerSimulatedHeartbeat,
    toggleSimulatedDeviceWifi,
    syncSimulatedDevice,
    rebootSimulatedDevice,
    deleteSimulatedDevice,
    addSimulatedDevice,
    resetSimulationData,
    resetDatabase,
    isResettingDb
  ]);

  return (
    <SystemModeContext.Provider value={contextValue}>
      {children}
    </SystemModeContext.Provider>
  );
}

export function useSystemMode() {
  const context = useContext(SystemModeContext);
  if (!context) {
    throw new Error('useSystemMode must be used within a SystemModeProvider');
  }
  return context;
}
