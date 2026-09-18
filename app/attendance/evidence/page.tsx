"use client"
import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Camera, Clock, AlertCircle } from 'lucide-react'

export default function EvidencePage() {
  const [evidence, setEvidence] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/attendance/evidence').then(res => res.json()).then(data => {
      setEvidence(data)
      setLoading(false)
    })
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">PIN Evidence Vault</h2>
          <p className="text-sm text-slate-500 mt-1">ESP-CAM image captures for PIN-based fallback authentication.</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1,2,3].map(i => <div key={i} className="h-64 bg-slate-200 rounded-xl"></div>)}
        </div>
      ) : evidence.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-300 bg-slate-50">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center text-slate-500">
            <Camera className="w-12 h-12 text-slate-400 mb-4" />
            <p className="font-medium text-slate-900">No PIN evidence recorded.</p>
            <p className="text-sm mt-1">Images will appear here when users check in using their PIN.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {evidence.map(item => (
            <Card key={item.id} className="overflow-hidden shadow-sm border-slate-200">
              <div className="aspect-video bg-slate-900 relative flex items-center justify-center border-b border-slate-200">
                {/* Mock image placeholder */}
                <div className="absolute inset-0 bg-gradient-to-tr from-slate-800 to-slate-900 flex flex-col items-center justify-center text-slate-500">
                  <Camera className="w-8 h-8 mb-2 opacity-50" />
                  <span className="text-xs font-mono opacity-50">ESP-CAM_CAPTURE_{item.id}</span>
                </div>
                
                {/* Status Badge overlay */}
                <div className="absolute top-3 left-3">
                   {item.attendance?.status === 'Late' && (
                     <span className="inline-flex items-center px-2 py-1 rounded bg-amber-500/90 text-white text-xs font-bold shadow-sm backdrop-blur-sm">
                       <AlertCircle className="w-3 h-3 mr-1" /> Late
                     </span>
                   )}
                </div>
              </div>
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900">{item.user.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{item.userId} • {item.user.role}</p>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-indigo-50 text-indigo-700">
                    PIN
                  </span>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center py-1.5 border-t border-slate-100">
                    <span className="text-slate-500">Capture Time</span>
                    <span className="font-medium text-slate-900 flex items-center">
                      <Clock className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                      {new Date(item.captureTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-t border-slate-100">
                    <span className="text-slate-500">Date</span>
                    <span className="font-medium text-slate-900">{item.attendance?.date}</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-t border-slate-100">
                    <span className="text-slate-500">Attendance ID</span>
                    <span className="font-mono text-xs text-slate-500">{item.attendanceId}</span>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
                   <button className="flex-1 py-2 text-sm font-medium text-center rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors">
                     View Original
                   </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
