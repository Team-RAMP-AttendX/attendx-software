"use client"
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HardDrive, Wifi, Battery, Plug, Activity, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function DevicesPage() {
  const [devices, setDevices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/devices').then(res => res.json()).then(data => {
      setDevices(data)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return <div className="animate-pulse space-y-4"><div className="h-48 bg-slate-200 rounded-xl"></div></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Device Management</h2>
          <p className="text-sm text-slate-500 mt-1">Monitor AttendX terminal health and sync status.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {devices.map(device => (
          <Card key={device.id} className={cn(
            "border-2 overflow-hidden",
            device.status === 'ONLINE' ? 'border-emerald-100 shadow-emerald-50' : 'border-slate-200 shadow-sm'
          )}>
            <div className={cn(
              "px-6 py-4 border-b flex justify-between items-center",
              device.status === 'ONLINE' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50 border-slate-200'
            )}>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-100">
                  <HardDrive className="w-5 h-5 text-slate-700" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{device.id}</h3>
                  <p className="text-xs text-slate-500 font-medium">Main Entrance Terminal</p>
                </div>
              </div>
              <span className={cn(
                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide",
                device.status === 'ONLINE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
              )}>
                {device.status === 'ONLINE' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>}
                {device.status}
              </span>
            </div>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                
                <div className="flex items-start space-x-3">
                  <Wifi className={cn("w-5 h-5 mt-0.5", device.wifiStatus === 'Connected' ? 'text-blue-500' : 'text-slate-400')} />
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Network</p>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">{device.wifiStatus}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Activity className={cn("w-5 h-5 mt-0.5", device.pendingRecords > 0 ? 'text-amber-500' : 'text-emerald-500')} />
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Sync Queue</p>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">
                      {device.pendingRecords} <span className="text-xs font-normal text-slate-500">pending</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  {device.powerStatus === 'AC' ? <Plug className="w-5 h-5 mt-0.5 text-emerald-500" /> : <Battery className="w-5 h-5 mt-0.5 text-amber-500" />}
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Power</p>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">
                      {device.powerStatus} <span className="text-xs font-normal text-slate-500">({device.batteryStatus}%)</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Clock className="w-5 h-5 mt-0.5 text-slate-400" />
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Last Sync</p>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">
                      {new Date(device.lastSync).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                  </div>
                </div>

              </div>
              
              {device.status === 'OFFLINE' && (
                <div className="mt-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <p className="text-sm text-slate-600 font-medium">Terminal is offline. Attendance records are safely stored locally and will synchronize automatically when connection is restored.</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
