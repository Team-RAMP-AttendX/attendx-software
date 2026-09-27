'use client';

import React, { useState } from 'react';
import { SystemModeProvider, useSystemMode } from '@/context/SystemModeContext';
import AdminAuthGate from '@/components/auth/AdminAuthGate';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopNav } from '@/components/layout/TopNav';
import { Sparkles, Menu, X } from 'lucide-react';

function ShellInner({ children }: { children: React.ReactNode }) {
  const { isSimulationMode, toggleSimulationMode, simState, isHydrated, isAuthenticated } = useSystemMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    <div className="h-full flex w-full relative">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/80 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar onNavigate={() => setSidebarOpen(false)} />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden w-full">
        <div className="flex items-center w-full bg-white border-b border-slate-200">
          <button
            type="button"
            className="md:hidden p-4 text-slate-500 hover:text-slate-900 focus:outline-none"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
          <div className="flex-1 min-w-0">
            <TopNav />
          </div>
        </div>
        
        {/* Simulation Mode Floating Notification Banner */}
        {isSimulationMode && (
          <div className="bg-purple-900/90 text-purple-100 px-4 py-2 text-xs flex items-center justify-between border-b border-purple-700/60 shadow-sm animate-fadeIn">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-purple-300 animate-pulse flex-shrink-0" />
              <span className="font-bold tracking-wide uppercase text-[11px] bg-purple-800/80 px-2 py-0.5 rounded text-purple-200 hidden sm:inline-block">
                Simulation Mode Active
              </span>
              <span className="inline sm:hidden font-bold tracking-wide uppercase text-[11px] bg-purple-800/80 px-2 py-0.5 rounded text-purple-200">
                SIM MODE
              </span>
              <span className="hidden md:inline text-purple-200 truncate">
                Running entirely in-memory. Zero reads &amp; zero writes to Cloud Firestore.
              </span>
              {simState.liveLogMessage && (
                <span className="hidden sm:inline text-[11px] bg-purple-950/60 text-purple-300 font-mono px-2 py-0.5 rounded truncate">
                  {simState.liveLogMessage}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={toggleSimulationMode}
              className="text-[10px] sm:text-xs font-semibold underline hover:text-white px-2 py-0.5 whitespace-nowrap flex-shrink-0"
            >
              Switch to Live DB
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto bg-slate-50 p-2 sm:p-4 md:p-6 lg:p-8">
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
