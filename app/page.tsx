"use client"
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, UserCheck, UserX, Clock, Fingerprint, Hash, HardDrive, Camera } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, LineChart, Line, CartesianGrid, XAxis, YAxis } from 'recharts'
import { cn } from '@/lib/utils'

export default function DashboardPage() {
  const [data, setData] = useState<any>(null)
  const [feed, setFeed] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashRes, feedRes] = await Promise.all([
          fetch('/api/dashboard'),
          fetch('/api/attendance/feed')
        ])
        const dashData = await dashRes.json()
        const feedData = await feedRes.json()
        setData(dashData)
        setFeed(feedData)
      } catch (err) {
        console.error("Failed to load dashboard data", err)
      }
    }
    fetchData()
  }, [])

  if (!data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-slate-200 rounded"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="h-32 bg-slate-200 rounded-lg"></div>)}
        </div>
      </div>
    )
  }

  const { metrics, analytics, trend } = data

  const authData = [
    { name: 'Fingerprint', value: analytics.fingerprint },
    { name: 'PIN', value: analytics.pin },
  ]
  const COLORS = ['#3b82f6', '#f59e0b']

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard Overview</h2>
          <p className="text-sm text-slate-500 mt-1">Today&apos;s attendance metrics and real-time activity.</p>
        </div>
        <div className="flex items-center space-x-2 text-sm">
          <span className="flex items-center text-emerald-600 font-medium bg-emerald-50 px-2.5 py-0.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
            Live
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Users" value={metrics.totalUsers} icon={<Users className="w-5 h-5 text-slate-400" />} />
        <StatCard title="Present Today" value={metrics.presentToday} icon={<UserCheck className="w-5 h-5 text-emerald-500" />} />
        <StatCard title="Absent Today" value={metrics.absentToday} icon={<UserX className="w-5 h-5 text-red-500" />} />
        <StatCard title="Late Today" value={metrics.lateToday} icon={<Clock className="w-5 h-5 text-amber-500" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Authentication Mode Analytics */}
        <Card className="col-span-1 border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Authentication Mode</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
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
                <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                <span className="text-sm text-slate-600 font-medium">Fingerprint ({analytics.fingerprint})</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-amber-500 mr-2"></div>
                <span className="text-sm text-slate-600 font-medium">PIN ({analytics.pin})</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 7-Day Attendance Trend */}
        <Card className="col-span-1 lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-900 uppercase tracking-wider">7-Day Attendance Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  <Line type="monotone" dataKey="present" name="Present" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Attendance Feed */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="space-y-6">
              {feed.slice(0, 5).map((record) => (
                <div key={record.id} className="flex items-start justify-between border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-start space-x-4">
                    <div className={cn(
                      "p-2 rounded-full",
                      record.checkInMode === 'fingerprint' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                    )}>
                      {record.checkInMode === 'fingerprint' ? <Fingerprint className="w-5 h-5" /> : <Hash className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{record.user?.name} <span className="text-xs text-slate-500 ml-2">{record.user?.role}</span></p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs text-slate-500">{new Date(record.checkInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-xs font-medium text-slate-700 capitalize">{record.checkInMode}</span>
                        {record.status === 'Late' && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Late ({record.lateDurationMinutes}m)</span>
                          </>
                        )}
                        {record.hasImage && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-xs font-medium text-indigo-600 flex items-center"><Camera className="w-3 h-3 mr-1"/> Evidence</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    {record.syncStatus === 'Synced' ? 'Synced' : 'Pending'}
                  </div>
                </div>
              ))}
              {feed.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">No recent attendance activity.</p>
              )}
            </div>
          </CardContent>
        </Card>
    </div>
  )
}

function StatCard({ title, value, icon }: { title: string, value: number, icon: React.ReactNode }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="text-3xl font-bold tracking-tight text-slate-900">{value}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-full">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
