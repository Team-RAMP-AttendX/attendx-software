"use client"
import React, { useEffect, useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Fingerprint, Hash, Camera, CameraOff, Clock, CheckCircle2, AlertCircle, Sparkles, Plus, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSystemMode } from '@/context/SystemModeContext'

export default function AttendanceLiveFeed() {
  const { isSimulationMode, simState, triggerSimulatedCheckIn } = useSystemMode()
  const [realFeed, setRealFeed] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSimulationMode) {
      const fetchFeed = () => {
        fetch('/api/attendance/feed')
          .then(res => res.json())
          .then(data => {
            setRealFeed(Array.isArray(data) ? data : [])
            setLoading(false)
          })
          .catch(() => setLoading(false))
      }

      fetchFeed()
      const interval = setInterval(fetchFeed, 4000)
      return () => clearInterval(interval)
    }
  }, [isSimulationMode])

  const feed = useMemo(() => {
    if (isSimulationMode) {
      return simState.attendance.map(a => ({
        ...a,
        user: simState.users.find(u => u.id === a.userId),
        hasImage: simState.images.some(img => img.attendanceId === a.id)
      }))
    }
    return realFeed
  }, [isSimulationMode, simState, realFeed])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Live Attendance Feed</h2>
          <p className="text-xs text-slate-500 mt-1">
            {isSimulationMode 
              ? 'Real-time mock stream for demonstration. Zero DB operations.'
              : 'Real-time check-in and check-out events from physical ESP32 terminals.'}
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          {isSimulationMode ? (
            <div className="flex items-center space-x-2">
              <span className="flex items-center text-purple-700 font-semibold bg-purple-100 px-3 py-1 rounded-full border border-purple-200">
                <Sparkles className="w-3.5 h-3.5 mr-1 text-purple-600 animate-spin" />
                Simulation Active
              </span>
              <button
                type="button"
                onClick={() => triggerSimulatedCheckIn('USR002', 'fingerprint')}
                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-sm flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Inject Event</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm">
              <span className="flex items-center text-emerald-600 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
                Hardware Polling (Live)
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 max-w-4xl">
        {!isSimulationMode && loading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-200 rounded-xl"></div>)}
          </div>
        ) : feed.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
            <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">Clean Slate: Zero Records in Database</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              All previous attendance has been reset. Place a finger on the ESP32 optical sensor or punch a PIN on the keypad to see live events appear here instantly!
            </p>
          </div>
        ) : (
          feed.map((record) => (
            <Card key={record.id} className="border-slate-200 shadow-sm overflow-hidden hover:border-slate-300 transition-colors bg-white">
              <div className="flex flex-col sm:flex-row">
                <div className={cn(
                  "w-full sm:w-2 flex-shrink-0 h-2 sm:h-auto",
                  record.status === 'Late' ? 'bg-amber-500' : 'bg-emerald-500'
                )}></div>
                <CardContent className="flex-1 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "p-3 rounded-xl border flex-shrink-0",
                      record.checkInMode === 'fingerprint' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-amber-50 border-amber-100 text-amber-600'
                    )}>
                      {record.checkInMode === 'fingerprint' ? <Fingerprint className="w-5 h-5" /> : <Hash className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-slate-900">{record.user?.name || record.userId}</h3>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <span className="text-xs font-medium text-slate-500">{record.user?.role || 'User'}</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-xs text-slate-400 font-mono">ID: {record.userId}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 sm:gap-6 sm:ml-auto">
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Timestamp</p>
                      <p className="text-sm font-bold text-slate-900 flex items-center mt-0.5 font-mono">
                        <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        {new Date(record.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </p>
                    </div>

                    <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>

                    <div className="flex flex-col gap-1 items-start sm:items-end">
                      <div className="flex items-center space-x-2">
                        {record.status === 'Late' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Late ({record.lateDurationMinutes}m)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Present
                          </span>
                        )}
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 capitalize">
                          {record.checkInMode}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 justify-end">
                        {record.offlineBuffered && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200" title="Captured locally on terminal SPIFFS during network outage and burst-replayed chronologically upon Wi-Fi recovery.">
                            <Clock className="w-3 h-3 mr-1 text-amber-600" /> Buffered Replay
                          </span>
                        )}
                        {record.checkInMode === 'pin' && (
                          record.hasImage ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                              <Camera className="w-3 h-3 mr-1" /> Evidence Logged
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-50 text-slate-500 border border-slate-200" title="Photo capture dropped across network outage (non-retried). PIN authentication was verified safely.">
                              <CameraOff className="w-3 h-3 mr-1 text-slate-400" /> Photo Dropped (Outage)
                            </span>
                          )
                        )}
                        {record.checkInMode === 'fingerprint' && record.hasImage && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                            <Camera className="w-3 h-3 mr-1" /> Evidence Logged
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
