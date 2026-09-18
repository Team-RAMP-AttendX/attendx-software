"use client"
import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Search, Download, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function HistoryPage() {
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchTerm, setSearchTerm] = useState("")
  const [dateFilter, setDateFilter] = useState("")
  const [roleFilter, setRoleFilter] = useState("All Roles")
  const [modeFilter, setModeFilter] = useState("All Methods")

  useEffect(() => {
    fetch('/api/attendance/history').then(res => res.json()).then(data => {
      setHistory(data)
      setLoading(false)
    })
  }, [])

  const filteredHistory = history.filter(record => {
    const matchesSearch = record.user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          record.userId.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesDate = !dateFilter || record.date === dateFilter
    const matchesRole = roleFilter === "All Roles" || record.user.role === roleFilter
    const matchesMode = modeFilter === "All Methods" || 
                        (record.checkInMode && record.checkInMode.toLowerCase() === modeFilter.toLowerCase()) ||
                        (record.checkOutMode && record.checkOutMode.toLowerCase() === modeFilter.toLowerCase())
    
    return matchesSearch && matchesDate && matchesRole && matchesMode
  })

  const exportToCSV = () => {
    if (filteredHistory.length === 0) return

    const headers = ['Date', 'Time', 'Name', 'User ID', 'Role', 'Check-In Mode', 'Check-Out Mode', 'Status', 'Late Duration (m)', 'Device ID', 'Sync Status']
    const rows = filteredHistory.map(r => [
      r.date,
      new Date(r.checkInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      `"${r.user.name}"`, // Quote to handle commas in names
      r.userId,
      r.user.role,
      r.checkInMode || '-',
      r.checkOutMode || '-',
      r.status,
      r.lateDurationMinutes || 0,
      r.deviceId,
      r.syncStatus
    ])
    
    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `attendance_history_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Attendance History</h2>
          <p className="text-sm text-slate-500 mt-1">Comprehensive logs of all Check-In and Check-Out events.</p>
        </div>
        <button 
          onClick={exportToCSV}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 h-10 px-4 py-2 shadow-sm"
        >
          <Download className="w-4 h-4 mr-2" /> Export to Excel
        </button>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 items-center bg-slate-50">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search user or ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-400 ml-2" />
            <input 
              type="date" 
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="text-sm border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
            />
            <select 
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="text-sm border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>All Roles</option>
              <option value="Student">Student</option>
              <option value="Staff">Staff</option>
            </select>
            <select 
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              className="text-sm border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>All Methods</option>
              <option value="Fingerprint">Fingerprint</option>
              <option value="PIN">PIN</option>
            </select>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-medium">Date & Time</th>
                <th className="px-6 py-4 font-medium">User</th>
                <th className="px-6 py-4 font-medium">Check-In Mode</th>
                <th className="px-6 py-4 font-medium">Check-Out Mode</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Device ID</th>
                <th className="px-6 py-4 font-medium">Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                 <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500">Loading history...</td></tr>
              ) : filteredHistory.length === 0 ? (
                 <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500">No records found matching filters.</td></tr>
              ) : filteredHistory.map(record => (
                <tr key={record.id} className="bg-white hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-900">{record.date}</span>
                      <span className="text-xs text-slate-500 mt-0.5">{new Date(record.checkInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-900">{record.user.name}</span>
                      <span className="text-xs text-slate-500 mt-0.5">{record.userId}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="capitalize font-medium text-slate-700">{record.checkInMode || '-'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="capitalize font-medium text-slate-700">{record.checkOutMode || '-'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "inline-flex px-2 py-1 text-xs font-semibold rounded-full",
                      record.status === 'Late' ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                    )}>
                      {record.status} {record.status === 'Late' && `(${record.lateDurationMinutes}m)`}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                    {record.deviceId}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "flex items-center text-xs font-medium",
                      record.syncStatus === 'Synced' ? "text-emerald-600" : "text-amber-600"
                    )}>
                      <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5", record.syncStatus === 'Synced' ? "bg-emerald-500" : "bg-amber-500")}></span>
                      {record.syncStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
