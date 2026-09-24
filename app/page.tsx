"use client"
import React, { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, UserCheck, UserX, Clock, Fingerprint, Hash, HardDrive, Camera, Sparkles, Activity, CheckCircle2 } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, LineChart, Line, CartesianGrid, XAxis, YAxis } from 'recharts'
import { cn } from '@/lib/utils'
import { useSystemMode } from '@/context/SystemModeContext'

export default function DashboardPage() {
  const { isSimulationMode, simState, triggerSimulatedCheckIn } = useSystemMode()

  const [realData, setRealData] = useState<any>(null)
  const [realFeed, setRealFeed] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    if (!isSimulationMode) {
      Promise.all([
        fetch('/api/dashboard').then(r => r.json()),
        fetch('/api/attendance/feed').then(r => r.json())
      ])
        .then(([dashData, feedData]) => {
          if (active) {
            setRealData(dashData)
            setRealFeed(Array.isArray(feedData) ? feedData : [])
            setLoading(false)
          }
        })
        .catch(err => {
          console.error("Failed to load dashboard data", err)
          if (active) setLoading(false)
        })
    }
    return () => { active = false }
  }, [isSimulationMode])

  // Derive simulation dashboard data when in Simulation Mode (Zero DB)
  const simulationDerived = useMemo(() => {
    if (!isSimulationMode) return null

    const today = new Date().toISOString().split('T')[0]
    const totalUsers = simState.users.length
    const totalStudents = simState.users.filter(u => u.role === 'Student').length
    const totalStaff = simState.users.filter(u => u.role === 'Staff').length

    const todaysAttendance = simState.attendance.filter(a => a.date === today)
    const presentToday = todaysAttendance.length
    const absentToday = Math.max(0, totalUsers - presentToday)
    const lateToday = todaysAttendance.filter(a => a.status === 'Late').length
    const onTimeToday = presentToday - lateToday

    const fpCount = todaysAttendance.filter(a => a.checkInMode === 'fingerprint').length
    const pinCount = todaysAttendance.filter(a => a.checkInMode === 'pin').length

    // 7-day trend
    const trend = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dStr = d.toISOString().split('T')[0]
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' })
      const count = simState.attendance.filter(a => a.date === dStr).length
      trend.push({ name: dayName, present: count })
    }

    // Enriched feed with user names
    const feed = simState.attendance.map(a => {
      const user = simState.users.find(u => u.id === a.userId)
      const hasImage = simState.images.some(img => img.attendanceId === a.id)
      return {
        ...a,
        user,
        hasImage
      }
    })

    return {
      metrics: {
        totalUsers,
        totalStudents,
        totalStaff,
        presentToday,
        absentToday,
        lateToday,
        onTimeToday
      },
      analytics: {
        fingerprint: fpCount,
        pin: pinCount,
        attendanceRate: totalUsers ? Math.round((presentToday / totalUsers) * 100) : 0,
        lateRate: presentToday ? Math.round((lateToday / presentToday) * 100) : 0
      },
      trend,
      feed
    }
  }, [isSimulationMode, simState])

  const activeData = isSimulationMode ? simulationDerived : realData
  const activeFeed = isSimulationMode ? (simulationDerived?.feed || []) : realFeed

  if (!activeData && loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-slate-200 rounded"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-slate-200 rounded-lg"></div>)}
        </div>
      </div>
    )
  }

  const { metrics, analytics, trend } = activeData || {
    metrics: { totalUsers: 0, presentToday: 0, absentToday: 0, lateToday: 0 },
    analytics: { fingerprint: 0, pin: 0 },
    trend: []
  }

  const authData = [
    { name: 'Fingerprint', value: analytics.fingerprint || 0 },
    { name: 'PIN', value: analytics.pin || 0 },
  ]
  const COLORS = ['#6366f1', '#f59e0b']

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Dashboard Overview
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isSimulationMode 
              ? 'Simulation Mode: Dynamic in-memory stream without touching database.' 
              : "Live Firestore: Synchronized with ESP32 terminals and physical sensors."}
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          {isSimulationMode ? (
            <div className="flex items-center space-x-2">
              <span className="flex items-center text-purple-700 font-semibold bg-purple-100 px-3 py-1 rounded-full border border-purple-200">
                <Sparkles className="w-3.5 h-3.5 mr-1.5 text-purple-600 animate-spin" />
                Simulation Active
              </span>
              <button
                type="button"
                onClick={() => triggerSimulatedCheckIn('USR001', 'fingerprint')}
                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-sm"
              >
                + Inject Scan
              </button>
            </div>
          ) : (
            <span className="flex items-center text-emerald-700 font-semibold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
              Live Firestore (Hardware Ready)
            </span>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Users" value={metrics.totalUsers} icon={<Users className="w-5 h-5 text-slate-400" />} />
        <StatCard title="Present Today" value={metrics.presentToday} icon={<UserCheck className="w-5 h-5 text-emerald-500" />} />
        <StatCard title="Absent Today" value={metrics.absentToday} icon={<UserX className="w-5 h-5 text-red-500" />} />
        <StatCard title="Late Today" value={metrics.lateToday} icon={<Clock className="w-5 h-5 text-amber-500" />} />
      </div>

      {/* Analytics & Trend Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Auth mode analytics */}
        <Card className="col-span-1 border-slate-200 shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Authentication Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            {analytics.fingerprint === 0 && analytics.pin === 0 ? (
              <div className="h-56 flex flex-col items-center justify-center text-center p-4">
                <Activity className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs text-slate-500 font-medium">No check-ins recorded yet.</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Ready for ESP32 optical sensor or keypad inputs.
                </p>
              </div>
            ) : (
              <>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={authData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {authData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex w-full justify-around mt-4">
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-indigo-500 mr-2"></div>
                    <span className="text-xs text-slate-600 font-medium">Fingerprint ({analytics.fingerprint})</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-amber-500 mr-2"></div>
                    <span className="text-xs text-slate-600 font-medium">PIN ({analytics.pin})</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Attendance trend */}
        <Card className="col-span-1 lg:col-span-2 border-slate-200 shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              7-Day Attendance Trajectory
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  <Line type="monotone" dataKey="present" name="Present" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Feed Card */}
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader>
          <CardTitle className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Recent Attendance Stream
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activeFeed.slice(0, 6).map((record) => (
              <div key={record.id} className="flex items-start justify-between border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                <div className="flex items-start space-x-3">
                  <div className={cn(
                    "p-2 rounded-xl",
                    record.checkInMode === 'fingerprint' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'
                  )}>
                    {record.checkInMode === 'fingerprint' ? <Fingerprint className="w-4 h-4" /> : <Hash className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">
                      {record.user?.name || record.userId} 
                      <span className="text-[11px] text-slate-500 font-normal ml-2">{record.user?.role || 'User'}</span>
                    </p>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <span className="text-[11px] text-slate-500">
                        {new Date(record.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-[11px] font-medium text-slate-700 capitalize">{record.checkInMode}</span>
                      {record.status === 'Late' && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                            Late ({record.lateDurationMinutes}m)
                          </span>
                        </>
                      )}
                      {record.hasImage && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="text-[10px] font-medium text-indigo-600 flex items-center">
                            <Camera className="w-3 h-3 mr-1"/> Evidence
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {record.deviceId || 'DEV_TERM_01'}
                </div>
              </div>
            ))}

            {activeFeed.length === 0 && (
              <div className="py-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600">Database is Pristine &amp; Zeroed</p>
                <p className="text-[11px] text-slate-400 mt-0.5 max-w-sm mx-auto">
                  No attendance records recorded yet. Ready for your live presentation or ESP32 terminal scan!
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ title, value, icon }: { title: string, value: number, icon: React.ReactNode }) {
  return (
    <Card className="border-slate-200 shadow-sm bg-white">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
