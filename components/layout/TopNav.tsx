'use client';

import React, { useState } from 'react';
import { useSystemMode } from '@/context/SystemModeContext';
import { 
  Bell, 
  Search, 
  User, 
  RotateCcw, 
  Sparkles, 
  Activity, 
  LogOut, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  HardDrive
} from 'lucide-react';

export function TopNav() {
  const { 
    isSimulationMode, 
    toggleSimulationMode, 
    adminEmail, 
    logout, 
    resetDatabase, 
    isResettingDb,
    triggerSimulatedCheckIn,
    simState
  } = useSystemMode();

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStatus, setResetStatus] = useState<string | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const handleConfirmReset = async () => {
    setResetStatus('Resetting database...');
    const result = await resetDatabase();
    if (result.success) {
      setResetStatus('Success! Database reset to zero-state.');
      setTimeout(() => {
        setShowResetModal(false);
        setResetStatus(null);
        window.location.reload();
      }, 1200);
    } else {
      setResetStatus(`Failed: ${result.message}`);
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm sm:px-6 lg:px-8">
      {/* Left Search / Breadcrumb */}
      <div className="flex items-center space-x-4 flex-1 max-w-md">
        <form className="relative flex-1" onSubmit={handleSearch}>
          <Search className="pointer-events-none absolute inset-y-0 left-0 h-full w-4 text-slate-400 pl-1" />
          <input
            id="search-field"
            className="block h-9 w-full rounded-lg border-0 bg-slate-50 py-1 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-1 focus:ring-indigo-500"
            placeholder="Search student, staff, slot, terminal..."
            type="search"
          />
        </form>
      </div>

      {/* Middle: System Mode Switcher */}
      <div className="flex items-center space-x-2">
        <div className="hidden sm:flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200">
          <button
            type="button"
            onClick={() => isSimulationMode && toggleSimulationMode()}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              !isSimulationMode 
                ? 'bg-emerald-600 text-white shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${!isSimulationMode ? 'bg-emerald-300 animate-pulse' : 'bg-slate-400'}`} />
            <span>Live Hardware &amp; DB</span>
          </button>

          <button
            type="button"
            onClick={() => !isSimulationMode && toggleSimulationMode()}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              isSimulationMode 
                ? 'bg-purple-600 text-white shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-200" />
            <span>Simulation Demo Mode</span>
          </button>
        </div>

        {/* Quick Simulation Trigger in Header when Simulation is ON */}
        {isSimulationMode && (
          <button
            type="button"
            onClick={() => triggerSimulatedCheckIn('USR001', 'fingerprint')}
            className="hidden md:inline-flex items-center space-x-1 px-2.5 py-1 bg-purple-100 hover:bg-purple-200 text-purple-800 text-xs font-semibold rounded-lg transition-colors border border-purple-300"
            title="Inject an instant simulated check-in event"
          >
            <span>+ Mock Scan</span>
          </button>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-3">
        {/* Reset Database Button */}
        <button
          type="button"
          onClick={() => setShowResetModal(true)}
          disabled={isResettingDb}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition-colors"
          title="Reset all past attendance records across Firestore for clean zero-state demo"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isResettingDb ? 'animate-spin' : ''}`} />
          <span className="hidden md:inline">Reset Database</span>
        </button>

        {/* Admin User & Logout */}
        <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
          <div className="hidden lg:flex flex-col text-right">
            <span className="text-xs font-semibold text-slate-800 truncate max-w-[160px]">
              {adminEmail}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {isSimulationMode ? 'Mock Simulator' : 'Master Administrator'}
            </span>
          </div>

          <button
            type="button"
            onClick={logout}
            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Lock Dashboard & Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center space-x-3 text-red-600 mb-3">
              <div className="p-2 rounded-xl bg-red-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Reset All Database Records?
              </h3>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              This will wipe all existing attendance history and camera evidence in your persistent Cloud Firestore database, reset user tallies to zero, and restore terminal queues to 0. 
              <br /><br />
              <strong>Use this before your live hardware demonstration to ensure a 100% clean zero-state!</strong>
            </p>

            {resetStatus && (
              <div className="mb-4 p-2.5 rounded-lg bg-slate-100 text-xs text-slate-800 font-mono flex items-center space-x-2">
                <Activity className="w-4 h-4 text-indigo-600 animate-spin" />
                <span>{resetStatus}</span>
              </div>
            )}

            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                disabled={isResettingDb}
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isResettingDb}
                onClick={handleConfirmReset}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm transition-colors flex items-center space-x-1.5"
              >
                {isResettingDb ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Zeroing Database...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Yes, Wipe All &amp; Zero State</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
