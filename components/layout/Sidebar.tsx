'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Users, 
  Clock, 
  History, 
  Camera, 
  FileBarChart, 
  HardDrive,
  Sparkles,
  Database,
  Cpu,
  ShieldCheck
} from 'lucide-react';
import { useSystemMode } from '@/context/SystemModeContext';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Live Feed', href: '/attendance', icon: Clock },
  { name: 'History', href: '/attendance/history', icon: History },
  { name: 'PIN Evidence', href: '/attendance/evidence', icon: Camera },
  { name: 'Reports', href: '/reports', icon: FileBarChart },
  { name: 'Devices', href: '/devices', icon: HardDrive },
  { name: 'Admin Control', href: '/admin-control', icon: ShieldCheck },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isSimulationMode } = useSystemMode();

  return (
    <div className="flex h-full w-64 flex-col bg-slate-900 border-r border-slate-800">
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between px-6 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md">
            <Cpu className="w-5 h-5 text-indigo-100" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            ATTEND<span className="text-indigo-400">X</span>
          </h1>
        </div>
      </div>

      {/* Nav items */}
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {navigation.map((item) => {
            const isActive = (() => {
              if (item.href === '/') {
                return pathname === '/';
              }
              if (item.href === '/attendance') {
                return pathname === '/attendance';
              }
              return (
                pathname === item.href ||
                (pathname.startsWith(item.href + '/') &&
                  !navigation.some(
                    (other) =>
                      other.href !== item.href &&
                      other.href.length > item.href.length &&
                      pathname.startsWith(other.href)
                  ))
              );
            })();

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                  'group flex items-center rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors'
                )}
              >
                <item.icon
                  className={cn(
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-white',
                    'mr-3 h-4 w-4 flex-shrink-0'
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Mode Status Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/60">
        {isSimulationMode ? (
          <div>
            <div className="flex items-center space-x-2 text-xs font-semibold text-purple-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Simulation Demo Mode</span>
            </div>
            <p className="text-[10px] text-purple-300/70 mt-1">
              Zero DB reads/writes. In-memory mock pipeline active.
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Cloud Firestore (Live)</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 truncate" title="ai-studio-attendx">
              Hardware ESP32 sync enabled
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
