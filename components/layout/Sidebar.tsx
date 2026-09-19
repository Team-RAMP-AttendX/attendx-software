"use client"
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Users, Clock, History, Camera, FileBarChart, Settings, HardDrive } from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Live Feed', href: '/attendance', icon: Clock },
  { name: 'History', href: '/attendance/history', icon: History },
  { name: 'PIN Evidence', href: '/attendance/evidence', icon: Camera },
  { name: 'Reports', href: '/reports', icon: FileBarChart },
  { name: 'Devices', href: '/devices', icon: HardDrive },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-full w-64 flex-col bg-slate-900 border-r border-slate-800">
      <div className="flex h-16 items-center px-6 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white tracking-tight">ATTEND<span className="text-blue-500">X</span></h1>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {navigation.map((item) => {
            // Precise active check preventing /attendance from conflicting with /attendance/history or /attendance/evidence
            const isActive = (() => {
              if (item.href === '/') {
                return pathname === '/';
              }
              if (item.href === '/attendance') {
                return pathname === '/attendance';
              }
              return pathname === item.href || (pathname.startsWith(item.href + '/') && !navigation.some(other => other.href !== item.href && other.href.length > item.href.length && pathname.startsWith(other.href)));
            })();
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                  'group flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors'
                )}
              >
                <item.icon
                  className={cn(
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-white',
                    'mr-3 h-5 w-5 flex-shrink-0'
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
