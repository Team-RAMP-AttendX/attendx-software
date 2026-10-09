"use client"
import { useEffect, useState, useMemo } from 'react'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Camera, CameraOff, Clock, AlertCircle, X, Download, ShieldCheck, WifiOff, Filter, Sparkles } from 'lucide-react'
import { useSystemMode } from '@/context/SystemModeContext'

export default function EvidencePage() {
  const { isSimulationMode, simState } = useSystemMode()
  const [evidence, setEvidence] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState<any | null>(null)
  const [filter, setFilter] = useState<'all' | 'captured' | 'dropped'>('all')

  useEffect(() => {
    if (!isSimulationMode) {
      fetch('/api/attendance/evidence')
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          setEvidence(Array.isArray(data) ? data : [])
          setLoading(false)
        })
        .catch(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [isSimulationMode])

  const simulationDerivedEvidence = useMemo(() => {
    if (!isSimulationMode) return []
    return simState.images.map(img => {
      const att = simState.attendance.find(a => a.id === img.attendanceId)
      const user = simState.users.find(u => u.id === img.userId)
      return {
        ...img,
        userName: user?.name || 'Unknown',
        userRole: user?.role || 'Student',
        deviceId: att?.deviceId || 'DEV_TERM_01',
        uploadStatus: 'captured',
        timestamp: img.captureTime
      }
    })
  }, [isSimulationMode, simState])

  const activeEvidence = isSimulationMode ? simulationDerivedEvidence : evidence

  const capturedCount = activeEvidence.filter(i => i.uploadStatus === 'captured' || (!i.uploadStatus && i.storageRef)).length
  const droppedCount = activeEvidence.filter(i => i.uploadStatus === 'upload_dropped').length

  const filteredEvidence = activeEvidence.filter(item => {
    const isDropped = item.uploadStatus === 'upload_dropped'
    if (filter === 'captured') return !isDropped
    if (filter === 'dropped') return isDropped
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#136CFC]">PIN Evidence Vault</h2>
          <p className="text-sm text-slate-500 mt-1">
            {isSimulationMode ? 'Simulated optical capture vault. Zero DB operations.' : 'ESP32-CAM optical evidence captures for PIN-based fallback authentication.'}
          </p>
        </div>

        {/* Filter Badges & Simulation indicator */}
        <div className="flex items-center gap-2">
          {isSimulationMode && (
            <span className="flex items-center text-xs text-purple-700 font-semibold bg-purple-100 px-3 py-1.5 rounded-full border border-purple-200">
              <Sparkles className="w-3.5 h-3.5 mr-1 text-purple-600 animate-spin" /> Simulation Active
            </span>
          )}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg text-xs font-medium">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-md transition-colors ${filter === 'all' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              All Records ({activeEvidence.length})
            </button>
            <button
              onClick={() => setFilter('captured')}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center space-x-1.5 ${filter === 'captured' ? 'bg-emerald-600 text-white shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Captured ({capturedCount})</span>
            </button>
            <button
              onClick={() => setFilter('dropped')}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center space-x-1.5 ${filter === 'dropped' ? 'bg-amber-600 text-white shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <WifiOff className="w-3.5 h-3.5" />
              <span>Dropped ({droppedCount})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Evidence Cards */}
      {!isSimulationMode && loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-64 bg-slate-100 rounded-xl animate-pulse"></div>
          ))}
        </div>
      ) : filteredEvidence.length === 0 ? (
        <Card className="border-slate-200 p-12 text-center shadow-sm">
          <CameraOff className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Photo Evidence In Vault</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            {isSimulationMode 
              ? 'Trigger a simulated PIN check-in to generate mock camera captures.' 
              : 'When users enter their PIN backup on a connected ESP32 terminal, the ESP32-S3-CAM will snapshot their face and upload the image here.'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredEvidence.map((item) => {
            const isDropped = item.uploadStatus === 'upload_dropped'
            return (
              <Card 
                key={item.id} 
                onClick={() => !isDropped && setSelectedImage(item)}
                className={`overflow-hidden border-slate-200 transition-all ${!isDropped ? 'cursor-pointer hover:shadow-md hover:border-slate-300' : 'opacity-85'}`}
              >
                {/* Photo Thumbnail Container */}
                <div className="relative h-44 w-full bg-slate-900 flex items-center justify-center overflow-hidden">
                  {isDropped ? (
                    <div className="p-4 text-center text-slate-400 space-y-1">
                      <WifiOff className="w-8 h-8 mx-auto text-amber-400 mb-2" />
                      <p className="text-xs font-bold text-amber-300">ESP32-S3-CAM Frame Dropped</p>
                      <p className="text-[10px] text-slate-400 leading-tight">PIN accepted without photo (Wi-Fi bandwidth saving mode)</p>
                    </div>
                  ) : (
                    <>
                      <Image 
                        src={item.storageRef || '/demo-evidence.jpg'} 
                        alt={`Evidence snapshot for ${item.userId}`}
                        fill
                        className="object-cover"
                        referrerPolicy="no-referrer"
                        style={{ transform: 'rotate(-210deg) scale(1.5)' }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none"></div>
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] text-white font-mono">
                        <span className="bg-black/60 px-2 py-0.5 rounded font-bold">{item.userId}</span>
                        <span className="bg-emerald-600/90 px-2 py-0.5 rounded font-semibold text-[10px]">SVGA Verified</span>
                      </div>
                    </>
                  )}
                </div>

                <CardContent className="p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 truncate">{item.userName || item.userId}</span>
                    <span className="text-[10px] font-mono text-slate-400">{item.deviceId || 'DEV_TERM_01'}</span>
                  </div>

                  <div className="flex items-center text-[11px] text-slate-500 space-x-1 font-mono">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{new Date(item.captureTime || item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(item.captureTime || item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Detail Image Lightbox Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="relative max-w-2xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700 text-white">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 mr-2" />
                  ESP32-S3-CAM Biometric Identity Verification
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  {selectedImage.userId} • {selectedImage.userName} • {selectedImage.deviceId}
                </p>
              </div>
              <button 
                onClick={() => setSelectedImage(null)} 
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative h-80 sm:h-96 w-full bg-black">
              <Image 
                src={selectedImage.storageRef || '/demo-evidence.jpg'} 
                alt="Enlarged evidence view"
                fill
                className="object-contain"
                referrerPolicy="no-referrer"
                style={{ transform: 'rotate(-210deg) scale(1.5)' }}
              />
            </div>

            <div className="p-4 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-slate-400 font-mono">
                Capture Time: <strong className="text-slate-200">{new Date(selectedImage.captureTime || selectedImage.timestamp).toLocaleString()}</strong>
              </div>
              <button 
                onClick={() => setSelectedImage(null)} 
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
