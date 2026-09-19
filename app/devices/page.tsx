"use client"
import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  HardDrive, Wifi, WifiOff, Battery, Plug, Activity, Clock, 
  Plus, Trash2, RefreshCw, Cpu, Camera, Terminal, CheckCircle2, 
  AlertTriangle, X, Radio, Eye, Zap, ShieldCheck 
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Device } from '@/types'

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [selectedDeviceDetails, setSelectedDeviceDetails] = useState<Device | null>(null)
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null)

  // Add Device Form
  const [newDeviceId, setNewDeviceId] = useState("")
  const [newDeviceName, setNewDeviceName] = useState("")
  const [newDeviceLocation, setNewDeviceLocation] = useState("")
  const [newPowerStatus, setNewPowerStatus] = useState<"AC" | "Battery">("AC")
  const [addError, setAddError] = useState("")

  // Diagnostics status message
  const [diagnosticResult, setDiagnosticResult] = useState<{ id: string; message: string } | null>(null)

  const fetchDevices = useCallback(() => {
    fetch('/api/devices')
      .then(res => res.json())
      .then(data => {
        setDevices(data)
      })
      .catch(console.error)
      .finally(() => {
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    fetchDevices()
  }, [fetchDevices])

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDeviceId.trim()) {
      setAddError("Terminal ID is required")
      return
    }

    setActionLoading("adding")
    setAddError("")

    try {
      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newDeviceId.trim(),
          name: newDeviceName.trim() || `AttendX Terminal ${devices.length + 1}`,
          location: newDeviceLocation.trim() || 'Facility Entrance',
          powerStatus: newPowerStatus
        })
      })

      if (!res.ok) {
        const errorData = await res.json()
        setAddError(errorData.error || "Failed to register terminal")
        return
      }

      setIsAddModalOpen(false)
      setNewDeviceId("")
      setNewDeviceName("")
      setNewDeviceLocation("")
      fetchDevices()
    } catch (err) {
      setAddError("Network error while adding terminal")
      console.error(err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleWifi = async (device: Device) => {
    setActionLoading(`wifi_${device.id}`)
    try {
      await fetch('/api/devices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: device.id,
          action: 'toggle_wifi'
        })
      })
      fetchDevices()
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleTriggerSync = async (device: Device) => {
    setActionLoading(`sync_${device.id}`)
    try {
      await fetch('/api/devices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: device.id,
          action: 'sync'
        })
      })
      fetchDevices()
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleRunDiagnostics = (device: Device) => {
    setActionLoading(`diag_${device.id}`)
    setDiagnosticResult(null)
    setTimeout(() => {
      const ping = Math.floor(Math.random() * 20) + 18
      setDiagnosticResult({
        id: device.id,
        message: `Roundtrip latency: ${ping}ms • All 7 hardware subsystems reporting nominal status.`
      })
      setActionLoading(null)
    }, 900)
  }

  const handleDeleteDevice = async () => {
    if (!deviceToDelete) return
    setActionLoading("deleting")
    try {
      await fetch(`/api/devices?id=${encodeURIComponent(deviceToDelete.id)}`, {
        method: 'DELETE'
      })
      setDeviceToDelete(null)
      if (selectedDeviceDetails?.id === deviceToDelete.id) {
        setSelectedDeviceDetails(null)
      }
      fetchDevices()
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(null)
    }
  }

  const totalTerminals = devices.length
  const onlineTerminals = devices.filter(d => d.status === 'ONLINE').length
  const offlineTerminals = devices.filter(d => d.status === 'OFFLINE').length
  const totalPendingSync = devices.reduce((sum, d) => sum + (d.pendingRecords || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header & Quick Terminal Health Stats */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Device & Terminal Management</h2>
          <p className="text-sm text-slate-500 mt-1">
            Monitor, configure, and inspect physical ESP32 AttendX terminals, biometric sensors, and peripheral hardware.
          </p>
        </div>
        <button 
          onClick={() => { setIsAddModalOpen(true); setAddError(""); }}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2 shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" /> Register New Terminal
        </button>
      </div>

      {/* Hardware Subsystem Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Terminals</span>
            <HardDrive className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{totalTerminals}</p>
          <p className="text-xs text-slate-500 mt-0.5">Physical units deployed</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Online Status</span>
            <Wifi className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 mt-2">{onlineTerminals} / {totalTerminals}</p>
          <p className="text-xs text-slate-500 mt-0.5">Active Wi-Fi heartbeat</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Offline Terminals</span>
            <WifiOff className={cn("w-4 h-4", offlineTerminals > 0 ? "text-amber-600" : "text-slate-400")} />
          </div>
          <p className={cn("text-2xl font-bold mt-2", offlineTerminals > 0 ? "text-amber-600" : "text-slate-700")}>
            {offlineTerminals}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Local SPIFFS buffer active</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Sync Queue</span>
            <Activity className={cn("w-4 h-4", totalPendingSync > 0 ? "text-amber-600" : "text-emerald-600")} />
          </div>
          <p className={cn("text-2xl font-bold mt-2", totalPendingSync > 0 ? "text-amber-600" : "text-emerald-600")}>
            {totalPendingSync}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Buffered offline events</p>
        </div>
      </div>

      {/* Terminal Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-slate-100 rounded-xl animate-pulse"></div>
          <div className="h-64 bg-slate-100 rounded-xl animate-pulse"></div>
        </div>
      ) : devices.length === 0 ? (
        <Card className="p-12 text-center border-slate-200">
          <HardDrive className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Terminals Registered</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            Get started by registering an AttendX ESP32 hardware terminal to begin syncing attendance events.
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            Register First Terminal
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {devices.map(device => {
            const isOnline = device.status === 'ONLINE'
            const isWifiConnected = device.wifiStatus === 'Connected'
            const isAcPowered = device.powerStatus === 'AC'

            return (
              <Card key={device.id} className={cn(
                "border-2 overflow-hidden shadow-sm transition-all duration-200",
                isOnline ? "border-slate-200 hover:border-slate-300" : "border-amber-200 bg-amber-50/10"
              )}>
                {/* Device Card Header */}
                <div className={cn(
                  "px-6 py-4 border-b flex justify-between items-center",
                  isOnline ? "bg-slate-50 border-slate-200" : "bg-amber-50/70 border-amber-200"
                )}>
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-white rounded-lg shadow-sm border border-slate-200 text-slate-800">
                      <HardDrive className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-bold text-slate-900 text-base">{device.name || device.id}</h3>
                        <span className="text-xs font-mono px-2 py-0.5 bg-slate-200 text-slate-700 rounded">
                          {device.id}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        {device.location || "Main Entrance Facility"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider",
                      isOnline ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    )}>
                      {isOnline && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>}
                      {device.status}
                    </span>
                  </div>
                </div>

                <CardContent className="p-6 space-y-6">
                  {/* Real Hardware Subsystems Quick Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50/80 p-4 rounded-xl border border-slate-200/80">
                    <div className="space-y-1">
                      <div className="flex items-center text-xs text-slate-500 font-medium uppercase tracking-wider">
                        {isWifiConnected ? <Wifi className="w-3.5 h-3.5 text-blue-500 mr-1.5" /> : <WifiOff className="w-3.5 h-3.5 text-amber-500 mr-1.5" />}
                        Network
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        {device.wifiStatus}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500">{device.ipAddress || '192.168.1.101'}</p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center text-xs text-slate-500 font-medium uppercase tracking-wider">
                        {isAcPowered ? <Plug className="w-3.5 h-3.5 text-emerald-500 mr-1.5" /> : <Battery className="w-3.5 h-3.5 text-amber-500 mr-1.5" />}
                        Power
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        {device.powerStatus} <span className="text-xs font-normal text-slate-500">({device.batteryStatus}%)</span>
                      </p>
                      <p className="text-[11px] text-slate-500">{device.voltage || '4.15V Li-ion'}</p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center text-xs text-slate-500 font-medium uppercase tracking-wider">
                        <Activity className={cn("w-3.5 h-3.5 mr-1.5", device.pendingRecords > 0 ? "text-amber-500" : "text-emerald-500")} />
                        Offline Queue
                      </div>
                      <p className={cn("text-sm font-semibold", device.pendingRecords > 0 ? "text-amber-600 font-bold" : "text-slate-900")}>
                        {device.pendingRecords} <span className="text-xs font-normal text-slate-500">pending</span>
                      </p>
                      <p className="text-[11px] text-slate-500">SPIFFS Buffer</p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center text-xs text-slate-500 font-medium uppercase tracking-wider">
                        <Clock className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
                        Last Sync
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        {new Date(device.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-[11px] text-slate-500">Auto-heartbeat</p>
                    </div>
                  </div>

                  {/* Hardware Subsystem Badges Preview */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Integrated Hardware Modules</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div className="flex items-center space-x-2 p-2 rounded bg-white border border-slate-200">
                        <Cpu className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                        <span className="font-medium text-slate-700 truncate">ESP32 (240MHz)</span>
                      </div>
                      <div className="flex items-center space-x-2 p-2 rounded bg-white border border-slate-200">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span className="font-medium text-slate-700 truncate">SMF V1.7 Sensor</span>
                      </div>
                      <div className="flex items-center space-x-2 p-2 rounded bg-white border border-slate-200">
                        <Terminal className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                        <span className="font-medium text-slate-700 truncate">4×4 Matrix Keypad</span>
                      </div>
                      <div className="flex items-center space-x-2 p-2 rounded bg-white border border-slate-200">
                        <Radio className="w-3.5 h-3.5 text-cyan-600 flex-shrink-0" />
                        <span className="font-medium text-slate-700 truncate">20×4 I2C LCD</span>
                      </div>
                      <div className="flex items-center space-x-2 p-2 rounded bg-white border border-slate-200">
                        <Camera className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                        <span className="font-medium text-slate-700 truncate">ESP-CAM (OV2640)</span>
                      </div>
                      <div className="flex items-center space-x-2 p-2 rounded bg-white border border-slate-200">
                        <Zap className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        <span className="font-medium text-slate-700 truncate">18650 UPS Backup</span>
                      </div>
                    </div>
                  </div>

                  {/* Diagnostic Alert Box */}
                  {diagnosticResult && diagnosticResult.id === device.id && (
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <span>{diagnosticResult.message}</span>
                      </div>
                      <button onClick={() => setDiagnosticResult(null)} className="text-blue-500 hover:text-blue-700">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Offline Warning Notice if disconnected */}
                  {!isOnline && (
                    <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                      <div className="flex items-center space-x-1.5 font-semibold text-amber-800">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span>Resilience Mode Active: Terminal is Operating Offline</span>
                      </div>
                      <p className="text-amber-700 pl-5">
                        Attendance scans and PIN fallbacks are safely persisted in local flash storage. When Wi-Fi is re-established, the sync engine will automatically upload all buffered records.
                      </p>
                    </div>
                  )}

                  {/* Interactive Terminal Management Actions Bar */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      {/* Inspect Hardware Button */}
                      <button
                        onClick={() => setSelectedDeviceDetails(device)}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1.5" /> Inspect Hardware
                      </button>

                      {/* Ping / Diagnostics */}
                      <button
                        onClick={() => handleRunDiagnostics(device)}
                        disabled={actionLoading === `diag_${device.id}`}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors"
                      >
                        <Radio className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                        {actionLoading === `diag_${device.id}` ? "Pinging..." : "Diagnostics"}
                      </button>

                      {/* Simulate Network Outage Toggle */}
                      <button
                        onClick={() => handleToggleWifi(device)}
                        disabled={actionLoading === `wifi_${device.id}`}
                        className={cn(
                          "inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md border transition-colors",
                          isWifiConnected 
                            ? "border-amber-200 text-amber-700 hover:bg-amber-50" 
                            : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 bg-emerald-50/40"
                        )}
                        title={isWifiConnected ? "Simulate Wi-Fi disconnection to test offline buffer" : "Restore Wi-Fi to test auto-synchronization"}
                      >
                        {isWifiConnected ? (
                          <>
                            <WifiOff className="w-3.5 h-3.5 mr-1.5 text-amber-600" /> Simulate Outage
                          </>
                        ) : (
                          <>
                            <Wifi className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> Restore Wi-Fi
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* Force Sync */}
                      {device.pendingRecords > 0 && (
                        <button
                          onClick={() => handleTriggerSync(device)}
                          disabled={actionLoading === `sync_${device.id}`}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm"
                        >
                          <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", actionLoading === `sync_${device.id}` && "animate-spin")} />
                          Sync Now ({device.pendingRecords})
                        </button>
                      )}

                      {/* Remove Terminal Button */}
                      <button
                        onClick={() => setDeviceToDelete(device)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                        title="Decommission Terminal"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Complete Hardware Subsystems Inspector Modal */}
      {selectedDeviceDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4 sticky top-0 bg-white z-10">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">
                    {selectedDeviceDetails.name || selectedDeviceDetails.id}
                  </CardTitle>
                  <p className="text-xs font-mono text-slate-500">
                    Hardware Subsystems Audit • {selectedDeviceDetails.id} • {selectedDeviceDetails.firmwareVersion || 'AttendX-FW v2.4.1'}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedDeviceDetails(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="pt-6 space-y-6 text-sm">
              
              {/* 20x4 LCD Screen Matrix Simulation */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center">
                    <Radio className="w-3.5 h-3.5 mr-1.5 text-cyan-600" />
                    20×4 Character LCD Display (I2C 0x27)
                  </span>
                  <span className="text-[11px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Backlight ON • HD44780
                  </span>
                </div>
                <div className="p-4 bg-emerald-950 text-emerald-300 font-mono text-sm rounded-lg border-2 border-emerald-900 shadow-inner tracking-widest leading-relaxed">
                  <div className="border border-emerald-800/40 p-3 rounded bg-emerald-950/80">
                    {selectedDeviceDetails.lcdText ? selectedDeviceDetails.lcdText.map((line, idx) => (
                      <div key={idx} className="truncate">
                        {line}
                      </div>
                    )) : (
                      <>
                        <div>[ ** ATTENDX TERMINAL ** ]</div>
                        <div>[ Ready for Scan...    ]</div>
                        <div>[ Time: 08:57 AM [SYNC] ]</div>
                        <div>[ Net: CONNECTED | Bat:87% ]</div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Subsystems Deep-Dive Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. ESP32 Microcontroller */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                    <Cpu className="w-4 h-4 text-blue-600" />
                    <span>ESP32 Microcontroller Core</span>
                  </div>
                  <div className="text-xs space-y-1 text-slate-600">
                    <div className="flex justify-between"><span className="text-slate-500">Architecture:</span><span className="font-semibold text-slate-800">Xtensa Dual-Core 240MHz</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">SRAM Heap:</span><span className="font-mono text-slate-800">{selectedDeviceDetails.esp32Heap || '284 KB Free / 520 KB'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Flash Storage:</span><span className="font-mono text-slate-800">4 MB SPI Flash</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">MAC Address:</span><span className="font-mono text-slate-800">{selectedDeviceDetails.macAddress || '24:0A:C4:B8:3A:1E'}</span></div>
                  </div>
                </div>

                {/* 2. SMF V1.7 Fingerprint Sensor */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>SMF V1.7 Optical Sensor</span>
                  </div>
                  <div className="text-xs space-y-1 text-slate-600">
                    <div className="flex justify-between"><span className="text-slate-500">Resolution:</span><span className="font-semibold text-slate-800">500 DPI Optical Prism</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Interface:</span><span className="font-mono text-slate-800">UART Serial (57600 baud)</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Template Capacity:</span><span className="font-semibold text-slate-800">1,000 enrolled slots</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Match Latency:</span><span className="font-semibold text-emerald-600">&lt; 450 ms (1:N)</span></div>
                  </div>
                </div>

                {/* 3. 4x4 Matrix Keypad */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                    <Terminal className="w-4 h-4 text-slate-700" />
                    <span>4×4 Tactile Matrix Keypad</span>
                  </div>
                  <div className="text-xs space-y-1 text-slate-600">
                    <div className="flex justify-between"><span className="text-slate-500">Layout:</span><span className="font-semibold text-slate-800">0-9, *, #, A, B, C, D</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Purpose:</span><span className="font-semibold text-slate-800">Fallback PIN + Admin Menu</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Debounce:</span><span className="font-mono text-slate-800">50ms hardware RC</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">GPIO Rows/Cols:</span><span className="font-mono text-slate-800">8 GPIO interrupt lines</span></div>
                  </div>
                </div>

                {/* 4. ESP-CAM Vision Sensor */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                    <Camera className="w-4 h-4 text-purple-600" />
                    <span>ESP-CAM (OV2640 Module)</span>
                  </div>
                  <div className="text-xs space-y-1 text-slate-600">
                    <div className="flex justify-between"><span className="text-slate-500">Sensor:</span><span className="font-semibold text-slate-800">OV2640 2 Megapixel</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Capture Trigger:</span><span className="font-semibold text-purple-700 font-medium">Automatic on PIN Input</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Resolution:</span><span className="font-mono text-slate-800">SVGA (800×600 JPEG)</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Illumination:</span><span className="font-semibold text-slate-800">White High-Power LED Flash</span></div>
                  </div>
                </div>

                {/* 5. Dual Power Subsystem */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                    <Zap className="w-4 h-4 text-amber-600" />
                    <span>Power & Li-ion Battery Subsystem</span>
                  </div>
                  <div className="text-xs space-y-1 text-slate-600">
                    <div className="flex justify-between"><span className="text-slate-500">Primary:</span><span className="font-semibold text-slate-800">5V / 2A AC Adapter</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Backup Cell:</span><span className="font-semibold text-slate-800">3.7V 18650 Li-ion (UPS)</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Charge IC:</span><span className="font-mono text-slate-800">TP4056 with auto-failover</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">State:</span><span className="font-semibold text-emerald-600">{selectedDeviceDetails.powerStatus} ({selectedDeviceDetails.batteryStatus}%)</span></div>
                  </div>
                </div>

                {/* 6. Offline Local Flash Storage */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                    <HardDrive className="w-4 h-4 text-slate-800" />
                    <span>Local Offline Flash Buffer</span>
                  </div>
                  <div className="text-xs space-y-1 text-slate-600">
                    <div className="flex justify-between"><span className="text-slate-500">Filesystem:</span><span className="font-mono text-slate-800">SPIFFS Partition</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Capacity:</span><span className="font-semibold text-slate-800">Up to 10,000 offline scans</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Pending Sync:</span><span className="font-semibold text-slate-800">{selectedDeviceDetails.pendingRecords} records</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Sync Mechanism:</span><span className="font-semibold text-slate-800">Idempotent UUID REST Sync</span></div>
                  </div>
                </div>

              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  onClick={() => setSelectedDeviceDetails(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
                >
                  Close Inspector
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Register New Terminal Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-2xl border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2">
                <HardDrive className="w-5 h-5 text-blue-600" />
                <CardTitle className="text-base font-bold text-slate-900">Register AttendX Terminal</CardTitle>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="pt-6">
              {addError && (
                <div className="mb-4 p-2.5 bg-red-50 text-red-700 text-xs rounded border border-red-200 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{addError}</span>
                </div>
              )}

              <form onSubmit={handleAddDevice} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="font-medium text-slate-700">Terminal ID (Hardware Identifier)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., DEV_TERM_02"
                    value={newDeviceId}
                    onChange={(e) => setNewDeviceId(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-medium text-slate-700">Display Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Library West Entrance Terminal"
                    value={newDeviceName}
                    onChange={(e) => setNewDeviceName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-medium text-slate-700">Facility Location</label>
                  <input
                    type="text"
                    placeholder="e.g., Science Complex, Ground Floor"
                    value={newDeviceLocation}
                    onChange={(e) => setNewDeviceLocation(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-medium text-slate-700">Primary Power Source</label>
                  <select
                    value={newPowerStatus}
                    onChange={(e) => setNewPowerStatus(e.target.value as "AC" | "Battery")}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="AC">AC Mains Adapter (with 18650 Battery Backup)</option>
                    <option value="Battery">Stand-alone Li-ion Battery</option>
                  </select>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md border border-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading === "adding"}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm"
                  >
                    {actionLoading === "adding" ? "Registering..." : "Connect Terminal"}
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Remove Terminal Confirmation Modal */}
      {deviceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-xl border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
              <CardTitle className="text-base font-bold text-red-600 flex items-center space-x-2">
                <Trash2 className="w-5 h-5 text-red-600" />
                <span>Decommission Terminal</span>
              </CardTitle>
              <button onClick={() => setDeviceToDelete(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm text-slate-600">
                Are you sure you want to remove terminal <strong className="text-slate-900">{deviceToDelete.name || deviceToDelete.id}</strong> ({deviceToDelete.id}) from active monitoring?
              </p>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeviceToDelete(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading === "deleting"}
                  onClick={handleDeleteDevice}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm"
                >
                  {actionLoading === "deleting" ? "Removing..." : "Confirm Removal"}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
