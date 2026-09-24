'use client';

import React from 'react';
import { SystemModeProvider, useSystemMode } from '@/context/SystemModeContext';
import AdminAuthGate from '@/components/auth/AdminAuthGate';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopNav } from '@/components/layout/TopNav';
import { Sparkles, X } from 'lucide-react';

function ShellInner({ children }: { children: React.ReactNode }) {
  const { isSimulationMode, toggleSimulationMode, simState, isHydrated, isAuthenticated } = useSystemMode();

  // If not hydrated yet, render nothing or basic splash to prevent hydration mismatch with localStorage
  if (!isHydrated) {
    return (
      <div className="h-full w-full min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  // If user is not authenticated, render the AdminAuthGate full-screen directly
  if (!isAuthenticated) {
    return <AdminAuthGate>{children}</AdminAuthGate>;
  }

  return (
    <div className="h-full flex w-full">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav />
        
        {/* Simulation Mode Floating Notification Banner */}
        {isSimulationMode && (
          <div className="bg-purple-900/90 text-purple-100 px-4 py-2 text-xs flex items-center justify-between border-b border-purple-700/60 shadow-sm animate-fadeIn">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-purple-300 animate-pulse" />
              <span className="font-bold tracking-wide uppercase text-[11px] bg-purple-800/80 px-2 py-0.5 rounded text-purple-200">
                Simulation Mode Active
              </span>
              <span className="hidden sm:inline text-purple-200">
                Running entirely in-memory. Zero reads &amp; zero writes to Cloud Firestore.
              </span>
              {simState.liveLogMessage && (
                <span className="text-[11px] bg-purple-950/60 text-purple-300 font-mono px-2 py-0.5 rounded">
                  {simState.liveLogMessage}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={toggleSimulationMode}
              className="text-xs font-semibold underline hover:text-white px-2 py-0.5"
            >
              Switch to Live DB
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SystemModeProvider>
      <ShellInner>{children}</ShellInner>
    </SystemModeProvider>
  );
}
