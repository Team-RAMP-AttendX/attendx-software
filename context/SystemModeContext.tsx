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
  resetSimulationData: () => void;

  // Real Database Reset
  resetDatabase: () => Promise<{ success: boolean; message: string }>;
  isResettingDb: boolean;
}

const SystemModeContext = createContext<SystemModeContextType | undefined>(undefined);

// External store subscription helpers for SSR-safe hydration
const subscribeToStorage = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
};

export function SystemModeProvider({ children }: { children: React.ReactNode }) {
  // Safe hydration detection without setState in effect
  const isHydrated = useSyncExternalStore(
    subscribeToStorage,
    () => true,
    () => false
  );

  const rawAuth = useSyncExternalStore(
    subscribeToStorage,
    () => {
      try {
        return localStorage.getItem('attendx_admin_auth') || '';
      } catch {
        return '';
      }
    },
    () => ''
  );

  const rawSim = useSyncExternalStore(
    subscribeToStorage,
    () => {
      try {
        return localStorage.getItem('attendx_simulation_mode') || 'false';
      } catch {
        return 'false';
      }
    },
    () => 'false'
  );

  const [activeSession, setActiveSession] = useState<{ email: string; token: string } | null>(null);
  const [explicitSimMode, setExplicitSimMode] = useState<boolean | null>(null);
  const [simState, setSimState] = useState<SimulationState>(createInitialSimulationState);
  const [isResettingDb, setIsResettingDb] = useState<boolean>(false);

  // Compute authenticated state
  const { isAuthenticated, adminEmail } = useMemo(() => {
    if (activeSession) {
      return { isAuthenticated: true, adminEmail: activeSession.email };
    }
    if (rawAuth) {
      try {
        const parsed = JSON.parse(rawAuth);
        if (parsed.email && parsed.sessionToken) {
          return { isAuthenticated: true, adminEmail: parsed.email };
        }
      } catch {
        // Ignore
      }
    }
    return { isAuthenticated: false, adminEmail: 'redemptionjonathan1@gmail.com' };
  }, [activeSession, rawAuth]);

  // Compute simulation mode state
  const isSimulationMode = useMemo(() => {
    if (explicitSimMode !== null) return explicitSimMode;
    return rawSim === 'true';
  }, [explicitSimMode, rawSim]);

  const login = useCallback((email: string, sessionToken: string) => {
    setActiveSession({ email, token: sessionToken });
    try {
      localStorage.setItem('attendx_admin_auth', JSON.stringify({ email, sessionToken, loggedInAt: new Date().toISOString() }));
      window.dispatchEvent(new Event('storage'));
    } catch {
      // Ignore
    }
  }, []);

  const logout = useCallback(() => {
    setActiveSession(null);
    try {
      localStorage.removeItem('attendx_admin_auth');
      window.dispatchEvent(new Event('storage'));
    } catch {
      // Ignore
    }
  }, []);

  const toggleSimulationMode = useCallback(() => {
    setExplicitSimMode(prev => {
      const current = prev !== null ? prev : (typeof window !== 'undefined' && localStorage.getItem('attendx_simulation_mode') === 'true');
      const next = !current;
      try {
        localStorage.setItem('attendx_simulation_mode', String(next));
        window.dispatchEvent(new Event('storage'));
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  const setSimulationMode = useCallback((val: boolean) => {
    setExplicitSimMode(val);
    try {
      localStorage.setItem('attendx_simulation_mode', String(val));
      window.dispatchEvent(new Event('storage'));
    } catch {
      // Ignore
    }
  }, []);

  const resetSimulationData = useCallback(() => {
    setSimState(createInitialSimulationState());
  }, []);

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
    isAuthenticated,
    adminEmail,
    login,
    logout,
    isSimulationMode,
    toggleSimulationMode,
    setSimulationMode,
    simState,
    triggerSimulatedCheckIn,
    triggerSimulatedEnrollment,
    triggerSimulatedHeartbeat,
    resetSimulationData,
    resetDatabase,
    isResettingDb
  }), [
    isHydrated,
    isAuthenticated,
    adminEmail,
    login,
    logout,
    isSimulationMode,
    toggleSimulationMode,
    setSimulationMode,
    simState,
    triggerSimulatedCheckIn,
    triggerSimulatedEnrollment,
    triggerSimulatedHeartbeat,
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
