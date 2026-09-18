"use client"
import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Fingerprint, Hash, Camera, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function AttendanceLiveFeed() {
  const [feed, setFeed] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/attendance/feed').then(res => res.json()).then(data => {
      setFeed(data)
      setLoading(false)
    })
    
    // Simulate real-time polling
    const interval = setInterval(() => {
      fetch('/api/attendance/feed').then(res => res.json()).then(data => setFeed(data))
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Live Attendance Feed</h2>
          <p className="text-sm text-slate-500 mt-1">Real-time check-in and check-out events from all terminals.</p>
        </div>
        <div className="flex items-center space-x-2 text-sm bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm">
          <span className="flex items-center text-emerald-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
            Live
          </span>
        </div>
      </div>

      <div className="space-y-4 max-w-4xl">
        {loading ? (
          <div className="animate-pulse space-y-4">
            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-200 rounded-lg"></div>)}
          </div>
        ) : feed.map((record) => (
          <Card key={record.id} className="border-slate-200 shadow-sm overflow-hidden hover:border-slate-300 transition-colors">
            <div className="flex flex-col sm:flex-row">
              <div className={cn(
                "w-full sm:w-2 flex-shrink-0 h-2 sm:h-auto",
                record.status === 'Late' ? 'bg-amber-500' : 'bg-emerald-500'
              )}></div>
              <CardContent className="flex-1 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "p-3 rounded-xl border flex-shrink-0",
                    record.checkInMode === 'fingerprint' ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-amber-50 border-amber-100 text-amber-600'
                  )}>
                    {record.checkInMode === 'fingerprint' ? <Fingerprint className="w-6 h-6" /> : <Hash className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{record.user?.name}</h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-sm font-medium text-slate-500">{record.user?.role}</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-sm text-slate-500">ID: {record.userId}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 sm:gap-6 sm:ml-auto">
                  
                  <div className="text-left sm:text-right">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Time</p>
                    <p className="text-lg font-bold text-slate-900 flex items-center mt-0.5">
                      <Clock className="w-4 h-4 mr-1.5 text-slate-400" />
                      {new Date(record.checkInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                  </div>

                  <div className="h-10 w-px bg-slate-200 hidden sm:block"></div>

                  <div className="flex flex-col gap-1.5 items-start sm:items-end">
                    <div className="flex items-center space-x-2">
                      {record.status === 'Late' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                          <AlertCircle className="w-3.5 h-3.5 mr-1" />
                          Late ({record.lateDurationMinutes}m)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          On Time
                        </span>
                      )}
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 capitalize">
                        {record.checkInMode}
                      </span>
                    </div>
                    {record.hasImage && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                        <Camera className="w-3.5 h-3.5 mr-1.5" /> Evidence Captured
                      </span>
                    )}
                  </div>
                  
                </div>
              </CardContent>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
