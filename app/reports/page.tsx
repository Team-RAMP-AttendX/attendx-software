"use client"
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { FileBarChart, Download, FileSpreadsheet, Calendar, Filter } from 'lucide-react'

export default function ReportsPage() {
  const [exporting, setExporting] = useState(false)
  
  // Report Config State
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [role, setRole] = useState("All Roles")
  const [method, setMethod] = useState("All Methods")
  const [status, setStatus] = useState("All Statuses")

  const handleExport = async () => {
    setExporting(true)
    
    try {
      // Fetch all history data (in MVP we fetch all and filter client-side for simplicity, 
      // in production this should be a query parameter to the backend)
      const res = await fetch('/api/attendance/history')
      const data = await res.json()
      
      const filtered = data.filter((record: any) => {
        const d = record.date
        const matchesStart = !startDate || d >= startDate
        const matchesEnd = !endDate || d <= endDate
        const matchesRole = role === "All Roles" || record.user.role === role
        const matchesMethod = method === "All Methods" || 
                              (record.checkInMode && record.checkInMode.toLowerCase() === method.toLowerCase()) ||
                              (record.checkOutMode && record.checkOutMode.toLowerCase() === method.toLowerCase())
        const matchesStatus = status === "All Statuses" || record.status === status
        
        return matchesStart && matchesEnd && matchesRole && matchesMethod && matchesStatus
      })

      if (filtered.length === 0) {
        alert("No records found for the selected configuration.")
        setExporting(false)
        return
      }

      const headers = ['Date', 'Time', 'Name', 'User ID', 'Role', 'Check-In Mode', 'Check-Out Mode', 'Status', 'Late Duration (m)', 'Device ID', 'Sync Status']
      const rows = filtered.map((r: any) => [
        r.date,
        new Date(r.checkInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        `"${r.user.name}"`, 
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
        ...rows.map((e: any[]) => e.join(','))
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", `attendance_report_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
    } catch (err) {
      console.error(err)
      alert("Failed to export report.")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Attendance Reports</h2>
          <p className="text-sm text-slate-500 mt-1">Generate and export filter-aware attendance reports.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="col-span-1 lg:col-span-2 border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <h3 className="font-semibold text-slate-900 mb-6 flex items-center">
              <Filter className="w-5 h-5 mr-2 text-slate-500" /> Report Configuration
            </h3>
            
            <div className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Date Range</label>
                  <div className="flex space-x-2">
                    <div className="relative flex-1">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                      />
                    </div>
                    <span className="text-slate-400 self-center">to</span>
                    <div className="relative flex-1">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                      />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Role</label>
                  <select 
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>All Roles</option>
                    <option value="Student">Student</option>
                    <option value="Staff">Staff</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Authentication Method</label>
                  <select 
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>All Methods</option>
                    <option value="fingerprint">Fingerprint Only</option>
                    <option value="pin">PIN Only</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Attendance Status</label>
                  <select 
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>All Statuses</option>
                    <option value="Present">Present</option>
                    <option value="Late">Late</option>
                    <option value="Absent">Absent</option>
                  </select>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 border-slate-200 shadow-sm bg-slate-50">
          <CardContent className="p-6 flex flex-col h-full">
            <h3 className="font-semibold text-slate-900 mb-2">Export Data</h3>
            <p className="text-sm text-slate-500 mb-8">Generate a downloadable Excel spreadsheet based on the configured filters.</p>
            
            <div className="mt-auto space-y-4">
              <button 
                onClick={handleExport}
                disabled={exporting}
                className="w-full flex items-center justify-center px-4 py-3 rounded-lg text-white font-medium bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
              >
                {exporting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Preparing Report...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-5 h-5 mr-2" />
                    Download Excel Report
                  </>
                )}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
