"use client"
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Camera, CameraOff, Clock, AlertCircle, X, Download, ShieldCheck, WifiOff, Filter } from 'lucide-react'

export default function EvidencePage() {
  const [evidence, setEvidence] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState<any | null>(null)
  const [filter, setFilter] = useState<'all' | 'captured' | 'dropped'>('all')

  useEffect(() => {
    fetch('/api/attendance/evidence')
      .then(res => res.json())
      .then(data => {
        setEvidence(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const capturedCount = evidence.filter(i => i.uploadStatus === 'captured' || (!i.uploadStatus && i.storageRef)).length
  const droppedCount = evidence.filter(i => i.uploadStatus === 'upload_dropped').length

  const filteredEvidence = evidence.filter(item => {
    const isDropped = item.uploadStatus === 'upload_dropped'
    if (filter === 'captured') return !isDropped
    if (filter === 'dropped') return isDropped
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">PIN Evidence Vault</h2>
          <p className="text-sm text-slate-500 mt-1">
            ESP32-CAM optical evidence captures for PIN-based fallback authentication.
          </p>
        </div>

        {/* Filter Badges */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg text-xs font-medium">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-md transition-colors ${filter === 'all' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            All Records ({evidence.length})
          </button>
          <button
            onClick={() => setFilter('captured')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 ${filter === 'captured' ? 'bg-white text-indigo-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <Camera className="w-3.5 h-3.5" />
            Captured ({capturedCount})
          </button>
          <button
            onClick={() => setFilter('dropped')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 ${filter === 'dropped' ? 'bg-white text-amber-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <WifiOff className="w-3.5 h-3.5" />
            Dropped in Outage ({droppedCount})
          </button>
        </div>
      </div>

      {/* Hardware Architectural Heads-up Notice */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 text-xs text-slate-700 space-y-1.5">
        <div className="flex items-center space-x-2 font-semibold text-slate-900">
          <ShieldCheck className="w-4 h-4 text-indigo-600" />
          <span>Hardware Behavior Note: Network Outage Resilience</span>
        </div>
        <p className="text-slate-600 leading-relaxed pl-6">
          Evidence photos are streamed directly via ESP32-CAM during PIN entries. Because image files require significant memory, firmware does not retry photo uploads across network outages to avoid RAM overflow. If Wi-Fi drops mid-upload, the check-in is logged as <strong>verified via PIN</strong> without crashing or halting check-ins.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1,2,3].map(i => <div key={i} className="h-64 bg-slate-200 rounded-xl"></div>)}
        </div>
      ) : filteredEvidence.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-300 bg-slate-50">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center text-slate-500">
            <Camera className="w-12 h-12 text-slate-400 mb-4" />
            <p className="font-medium text-slate-900">No records found for current filter.</p>
            <p className="text-sm mt-1">Select &quot;All Records&quot; or trigger a PIN check-in to populate evidence.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvidence.map(item => {
            const isDropped = item.uploadStatus === 'upload_dropped'

            return (
              <Card key={item.id} className="overflow-hidden shadow-sm border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="aspect-video bg-slate-900 relative flex items-center justify-center border-b border-slate-200 overflow-hidden">
                    {isDropped ? (
                      <div className="flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                        <div className="p-3 bg-slate-800/80 rounded-full mb-2 border border-slate-700">
                          <CameraOff className="w-6 h-6 text-amber-400" />
                        </div>
                        <p className="text-xs font-semibold text-slate-200">No Photo Attached</p>
                        <p className="text-[11px] text-slate-400 max-w-[200px] mt-0.5">
                          Upload dropped during Wi-Fi outage (non-retried)
                        </p>
                      </div>
                    ) : (
                      <>
                        <Image 
                          src={`https://picsum.photos/seed/${item.id}/400/225`} 
                          alt={`Evidence ${item.id}`} 
                          fill
                          referrerPolicy="no-referrer"
                          className="object-cover opacity-90 hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                      </>
                    )}
                    
                    {/* Status Badge overlay */}
                    <div className="absolute top-3 left-3 flex gap-1.5">
                      {item.attendance?.status === 'Late' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-500 text-white text-[11px] font-bold shadow-sm backdrop-blur-sm">
                          <AlertCircle className="w-3 h-3 mr-1" /> Late
                        </span>
                      )}
                      {isDropped ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-900/90 text-amber-200 text-[11px] font-semibold border border-amber-700/60 shadow-sm backdrop-blur-sm">
                          <WifiOff className="w-3 h-3 mr-1" /> Outage Dropped
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 text-[11px] font-semibold border border-emerald-700/50 shadow-sm backdrop-blur-sm">
                          <Camera className="w-3 h-3 mr-1" /> Captured
                        </span>
                      )}
                    </div>
                  </div>

                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-slate-900">{item.user?.name || item.userId}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{item.userId} • {item.user?.role || 'Staff'}</p>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-indigo-50 text-indigo-700">
                        PIN
                      </span>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center py-1.5 border-t border-slate-100">
                        <span className="text-slate-500 text-xs">Capture Time</span>
                        <span className="font-medium text-slate-900 text-xs flex items-center">
                          <Clock className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                          {new Date(item.captureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-t border-slate-100">
                        <span className="text-slate-500 text-xs">Date</span>
                        <span className="font-medium text-slate-900 text-xs">{item.attendance?.date || new Date(item.captureTime).toISOString().split('T')[0]}</span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-t border-slate-100">
                        <span className="text-slate-500 text-xs">Attendance ID</span>
                        <span className="font-mono text-[11px] text-slate-500 truncate max-w-[140px]">{item.attendanceId}</span>
                      </div>
                    </div>

                    {isDropped && (
                      <div className="mt-3 p-2 bg-amber-50 rounded text-[11px] text-amber-800 border border-amber-200/80 leading-normal">
                        Photo frame was dropped when terminal lost Wi-Fi. Attendance record is validly verified.
                      </div>
                    )}
                  </CardContent>
                </div>

                <div className="p-5 pt-0">
                  <div className="pt-3 border-t border-slate-100">
                    <button 
                      onClick={() => setSelectedImage(item)}
                      className="w-full py-2 text-xs font-medium text-center rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                    >
                      {isDropped ? 'View Details' : 'View Full Image'}
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Image / Evidence Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 md:p-8">
          <div className="bg-white rounded-xl overflow-hidden w-full max-w-4xl shadow-2xl flex flex-col max-h-full animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="font-bold text-lg text-slate-900">
                  PIN Verification: {selectedImage.user?.name || selectedImage.userId}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Check-in Timestamp: {new Date(selectedImage.captureTime).toLocaleString()}
                </p>
              </div>
              <button 
                onClick={() => setSelectedImage(null)} 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 flex-1 min-h-[320px] relative p-4 flex items-center justify-center">
              {selectedImage.uploadStatus === 'upload_dropped' ? (
                <div className="text-center p-8 max-w-md">
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4 border border-slate-700">
                    <CameraOff className="w-8 h-8 text-amber-400" />
                  </div>
                  <h4 className="text-base font-bold text-white">No Photo Stored for this Check-in</h4>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    The ESP32 terminal recorded this check-in during a network outage or Wi-Fi interruption. While attendance data is safely buffered in local SPIFFS flash, evidence photos are dropped (not retried) across outages by design to protect ESP-CAM microchip RAM.
                  </p>
                  <div className="mt-4 p-3 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-emerald-400 font-mono">
                    ✓ Status: Verified via Secure 4-Digit Employee PIN
                  </div>
                </div>
              ) : (
                <>
                  <Image 
                    src={`https://picsum.photos/seed/${selectedImage.id}/1280/720`} 
                    alt={`Evidence full ${selectedImage.id}`} 
                    fill
                    referrerPolicy="no-referrer"
                    className="rounded-lg shadow-sm object-contain p-2"
                  />
                  <div className="absolute bottom-6 right-6">
                    <button 
                      onClick={() => {
                        window.open(`https://picsum.photos/seed/${selectedImage.id}/1280/720`, '_blank')
                      }}
                      className="flex items-center justify-center bg-slate-900/90 text-white px-4 py-2 rounded-md font-medium text-xs shadow-md hover:bg-slate-800 transition-colors border border-slate-700"
                    >
                      <Download className="w-3.5 h-3.5 mr-2" />
                      Open Full Resolution
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 flex flex-wrap justify-between gap-4 text-xs text-slate-500 border-t border-slate-100 shrink-0 bg-slate-50">
              <div>
                <span className="block text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-0.5">User ID</span>
                <span className="font-semibold text-slate-900">{selectedImage.userId}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-0.5">Attendance Record</span>
                <span className="font-mono text-slate-900">{selectedImage.attendanceId}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-0.5">Photo Status</span>
                <span className={`font-semibold ${selectedImage.uploadStatus === 'upload_dropped' ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {selectedImage.uploadStatus === 'upload_dropped' ? 'Dropped Across Outage' : 'Captured & Verified'}
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-0.5">Punctuality</span>
                <span className="font-semibold text-slate-900">
                  {selectedImage.attendance?.status || 'Present'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
