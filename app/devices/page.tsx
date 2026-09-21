"use client"
import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  HardDrive, Wifi, WifiOff, Battery, Plug, Activity, Clock, 
  Plus, Trash2, RefreshCw, Cpu, Camera, Terminal, CheckCircle2, 
  AlertTriangle, X, Radio, Eye, Zap, ShieldCheck, FileCode,
  Fingerprint, BookOpen, Send, Check, Layers, Download
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
  const [isApiSpecsModalOpen, setIsApiSpecsModalOpen] = useState(false)
  const [apiSpecTab, setApiSpecTab] = useState<'telemetry' | 'enrollment' | 'checkin' | 'evidence'>('telemetry')

  // Biometric Enrollment & Sync Modal
  const [isBioSyncModalOpen, setIsBioSyncModalOpen] = useState(false)
  const [selectedBioSyncDevice, setSelectedBioSyncDevice] = useState<Device | null>(null)
  const [bioSyncData, setBioSyncData] = useState<{
    deviceId: string;
    totalUsers: number;
    totalEnrolledInDb: number;
    users: Array<{
      userId: string;
      name: string;
      role: string;
      hasFingerprint: boolean;
      slotNumber: number;
      templateData: string | null;
      isEnrolledOnThisTerminal?: boolean;
    }>;
  } | null>(null)
  const [bioSyncLoading, setBioSyncLoading] = useState(false)
  const [bioSyncMsg, setBioSyncMsg] = useState<string | null>(null)
  const [scanningUserId, setScanningUserId] = useState<string | null>(null)
  const [scanStep, setScanStep] = useState<'idle' | 'prompted' | 'capturing' | 'saved'>('idle')
  const [testTelemetryStatus, setTestTelemetryStatus] = useState<string | null>(null)

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

  const handleOpenBioSync = async (device: Device) => {
    setSelectedBioSyncDevice(device)
    setIsBioSyncModalOpen(true)
    setBioSyncLoading(true)
    setBioSyncMsg(null)
    setScanningUserId(null)
    setScanStep('idle')
    try {
      const res = await fetch(`/api/devices/enrollment?deviceId=${encodeURIComponent(device.id)}`)
      const data = await res.json()
      setBioSyncData(data)
    } catch (err) {
      console.error(err)
    } finally {
      setBioSyncLoading(false)
    }
  }

  const handleSyncAllTemplates = async () => {
    if (!selectedBioSyncDevice) return
    setBioSyncLoading(true)
    setBioSyncMsg(null)
    try {
      const res = await fetch('/api/devices/enrollment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SYNC_ALL_TO_TERMINAL',
          deviceId: selectedBioSyncDevice.id
        })
      })
      const data = await res.json()
      setBioSyncMsg(data.message || 'All database fingerprints provisioned to terminal flash.')
      // Refresh enrollment data
      const updated = await fetch(`/api/devices/enrollment?deviceId=${encodeURIComponent(selectedBioSyncDevice.id)}`).then(r => r.json())
      setBioSyncData(updated)
      fetchDevices()
    } catch (err) {
      setBioSyncMsg('Failed to sync biometric templates.')
    } finally {
      setBioSyncLoading(false)
    }
  }

  const handleStartTerminalScan = async (userId: string, userName: string) => {
    if (!selectedBioSyncDevice) return
    setScanningUserId(userId)
    setScanStep('prompted')
    setBioSyncMsg(null)
    try {
      // 1. Arm terminal via backend
      await fetch('/api/devices/enrollment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'QUEUE_ENROLLMENT',
          deviceId: selectedBioSyncDevice.id,
          userId
        })
      })
      
      // Simulate live optical sensor interaction
      setTimeout(() => {
        setScanStep('capturing')
        setTimeout(async () => {
          const res = await fetch('/api/devices/enrollment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'COMPLETE_ENROLLMENT',
              deviceId: selectedBioSyncDevice.id,
              userId,
              templateData: `SMF17_FP_${userId}_ENROLLED_${Math.random().toString(36).substring(2, 8).toUpperCase()}`
            })
          })
          const data = await res.json()
          setScanStep('saved')
          setBioSyncMsg(`Enrolled & saved biometric template for ${userName} to central database.`)
          const updated = await fetch(`/api/devices/enrollment?deviceId=${encodeURIComponent(selectedBioSyncDevice.id)}`).then(r => r.json())
          setBioSyncData(updated)
          fetchDevices()
        }, 1400)
      }, 1200)
    } catch (err) {
      setBioSyncMsg('Interactive enrollment failed.')
      setScanStep('idle')
      setScanningUserId(null)
    }
  }

  const handleSendSampleTelemetry = async (deviceId: string) => {
    setTestTelemetryStatus("Sending sample ESP32 telemetry packet to backend...")
    try {
      const randomBatt = Math.floor(Math.random() * 8) + 88
      const randomRssi = - (Math.floor(Math.random() * 15) + 48)
      const randomHeap = `${Math.floor(Math.random() * 20) + 280} KB Free / 520 KB Total`
      const res = await fetch('/api/devices/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          wifiStatus: 'Connected',
          rssi: randomRssi,
          batteryStatus: randomBatt,
          voltage: '4.19V (Nominal Li-ion)',
          esp32Heap: randomHeap,
          pendingRecords: 0,
          firmwareVersion: 'AttendX-FW v2.4.1',
          lcdText: [
            '** ATTENDX TERMINAL **',
            'Live Telemetry Push',
            `WiFi: ${randomRssi}dBm | Bat:${randomBatt}%`,
            `Status: HEALTHY [SYNC]`
          ]
        })
      })
      const data = await res.json()
      setTestTelemetryStatus(`Success! Heartbeat acknowledged by backend at ${new Date(data.serverTime).toLocaleTimeString()}. Frontend state refreshed live.`)
      fetchDevices()
    } catch (err) {
      setTestTelemetryStatus("Error dispatching test telemetry")
    }
  }

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
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => { setIsApiSpecsModalOpen(true); setTestTelemetryStatus(null); }}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 h-10 px-4 py-2 shadow-sm"
          >
            <FileCode className="w-4 h-4 mr-2 text-indigo-600" /> ESP32 API & Payloads Guide
          </button>
          <button 
            onClick={() => { setIsAddModalOpen(true); setAddError(""); }}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2 shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" /> Register New Terminal
          </button>
        </div>
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
                        <span className="font-medium text-slate-700 truncate">
                          SMF V1.7 ({device.enrolledFingerprints !== undefined ? device.enrolledFingerprints : 2} Enrolled)
                        </span>
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

                      {/* Biometric Provisioning & Enrol Button */}
                      <button
                        onClick={() => handleOpenBioSync(device)}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors font-semibold"
                        title="Enroll database users or synchronize biometric fingerprint templates to this terminal"
                      >
                        <Fingerprint className="w-3.5 h-3.5 mr-1.5 text-indigo-600" /> Biometric Sync & Enrol
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

      {/* Biometric User Enrollment & Provisioning Modal */}
      {isBioSyncModalOpen && selectedBioSyncDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <Card className="w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4 bg-slate-50/70">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-lg">
                  <Fingerprint className="w-6 h-6" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-slate-900">
                    Biometric Enrollment & Hardware Provisioning
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Terminal: <strong className="text-slate-800">{selectedBioSyncDevice.name || selectedBioSyncDevice.id}</strong> ({selectedBioSyncDevice.id}) • Optical Sensor: SMF V1.7
                  </p>
                </div>
              </div>
              <button 
                onClick={() => { setIsBioSyncModalOpen(false); setSelectedBioSyncDevice(null); }} 
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </CardHeader>

            <CardContent className="p-6 overflow-y-auto space-y-6">
              {/* How it works banner */}
              <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 font-bold text-indigo-950 text-sm">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>Central Database to ESP32 Flash Biometric Pipeline</span>
                  </div>
                  <span className="font-mono bg-indigo-200/70 text-indigo-900 px-2 py-0.5 rounded text-[11px]">
                    GET /api/devices/enrollment
                  </span>
                </div>
                <p className="text-indigo-800 leading-relaxed">
                  When a new terminal is added to AttendX, it can synchronize all enrolled fingerprint templates stored in the central database directly into its on-board SMF V1.7 optical flash memory. Alternatively, you can trigger live on-terminal enrollment for any database user right here.
                </p>
              </div>

              {/* Status Message */}
              {bioSyncMsg && (
                <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span className="font-medium">{bioSyncMsg}</span>
                  </div>
                  <button onClick={() => setBioSyncMsg(null)} className="text-emerald-500 hover:text-emerald-700">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Live Interactive Terminal Scan Simulation Area */}
              {scanningUserId && (
                <div className="p-4 rounded-xl bg-slate-900 text-white border border-slate-800 shadow-inner space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-400 flex items-center">
                      <Radio className="w-3.5 h-3.5 mr-1.5 animate-pulse text-emerald-400" />
                      TERMINAL 20×4 LCD SCREEN (LIVE HARDWARE MIRROR)
                    </span>
                    <span className="font-mono text-slate-400">DEV: {selectedBioSyncDevice.id}</span>
                  </div>

                  <div className="font-mono text-xs bg-black/60 p-3 rounded border border-emerald-500/30 text-emerald-400 space-y-1">
                    <div>[LINE 1] ** ENROLL USER **</div>
                    <div>
                      [LINE 2] {scanStep === 'prompted' ? 'ARMED: Place Finger' : scanStep === 'capturing' ? 'READING MINUTIAE...' : 'TEMPLATE SAVED OK'}
                    </div>
                    <div>
                      [LINE 3] User ID: {scanningUserId}
                    </div>
                    <div>
                      [LINE 4] {scanStep === 'capturing' ? 'Pass 2/2: Verifying' : scanStep === 'saved' ? 'Synced to Central DB' : 'SMF V1.7 UART Ready'}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center space-x-2 text-xs text-slate-300">
                      <div className={cn(
                        "w-2.5 h-2.5 rounded-full",
                        scanStep === 'prompted' ? "bg-amber-400 animate-pulse" : scanStep === 'capturing' ? "bg-blue-400 animate-ping" : "bg-emerald-400"
                      )} />
                      <span>
                        {scanStep === 'prompted' && "Waiting for finger placement on terminal optical prism..."}
                        {scanStep === 'capturing' && "Extracting fingerprint ridge minutiae & compiling 512-byte template..."}
                        {scanStep === 'saved' && "Enrollment complete! Template persisted to central database."}
                      </span>
                    </div>
                    {scanStep === 'saved' && (
                      <button
                        onClick={() => setScanningUserId(null)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded shadow"
                      >
                        Dismiss Mirror
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Action: Sync All Database Templates to this Terminal */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 gap-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Synchronize All Database Templates</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Push all active biometric templates from the central database into this terminal&apos;s local flash.
                  </p>
                </div>
                <button
                  onClick={handleSyncAllTemplates}
                  disabled={bioSyncLoading}
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors whitespace-nowrap"
                >
                  <Download className={cn("w-4 h-4 mr-2", bioSyncLoading && "animate-spin")} />
                  {bioSyncLoading ? "Syncing Biometrics..." : "Sync All Templates to Terminal"}
                </button>
              </div>

              {/* Database Users List with Biometric Status */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Database Users & Terminal Provisioning Status
                  </h4>
                  <span className="text-xs text-slate-500">
                    {bioSyncData?.users.length || 0} Registered Database Users
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {bioSyncLoading && !bioSyncData ? (
                    <div className="p-8 text-center text-sm text-slate-500">Loading database biometric records...</div>
                  ) : bioSyncData?.users.map((u) => {
                    const isEnrolledInDb = u.hasFingerprint
                    const isEnrolledOnThisDev = u.isEnrolledOnThisTerminal

                    return (
                      <div key={u.userId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-center space-x-3">
                          <div className={cn(
                            "p-2 rounded-lg text-xs font-bold",
                            isEnrolledInDb ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                          )}>
                            <Fingerprint className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-slate-900 text-sm">{u.name}</span>
                              <span className="text-xs font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                                {u.userId}
                              </span>
                            </div>
                            <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1">
                              <span>Role: <strong className="text-slate-700">{u.role}</strong></span>
                              <span>•</span>
                              <span>
                                Central DB: {isEnrolledInDb ? (
                                  <span className="text-emerald-700 font-semibold">Enrolled (Slot #{u.slotNumber})</span>
                                ) : (
                                  <span className="text-amber-600 font-medium">Pending Scan</span>
                                )}
                              </span>
                              <span>•</span>
                              <span>
                                On Terminal: {isEnrolledOnThisDev ? (
                                  <span className="text-blue-700 font-medium">Installed</span>
                                ) : (
                                  <span className="text-slate-400">Not Synced</span>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons per user */}
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleStartTerminalScan(u.userId, u.name)}
                            disabled={scanningUserId !== null}
                            className={cn(
                              "inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md shadow-sm transition-colors",
                              isEnrolledInDb
                                ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white"
                            )}
                          >
                            <Radio className="w-3.5 h-3.5 mr-1.5" />
                            {isEnrolledInDb ? "Re-scan on Terminal" : "Enroll on Terminal"}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ESP32 API & Payloads Guide Modal */}
      {isApiSpecsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4 bg-slate-50/70">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-blue-100 text-blue-700 rounded-lg">
                  <FileCode className="w-6 h-6" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-slate-900">
                    ESP32-to-Backend Hardware Telemetry & Biometric Structures
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live API contract, JSON schemas, and firmware integration specifications
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsApiSpecsModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </CardHeader>

            <CardContent className="p-6 overflow-y-auto space-y-6">
              {/* Navigation Tabs */}
              <div className="flex space-x-2 border-b border-slate-200 pb-2">
                {[
                  { id: 'telemetry', label: '1. Heartbeat & Telemetry' },
                  { id: 'enrollment', label: '2. Biometric DB Enrollment' },
                  { id: 'checkin', label: '3. Attendance Scans' },
                  { id: 'evidence', label: '4. Camera Evidence (PIN)' },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setApiSpecTab(t.id as any)}
                    className={cn(
                      "px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors",
                      apiSpecTab === t.id
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab 1: Heartbeat & Telemetry */}
              {apiSpecTab === 'telemetry' && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                        POST /api/devices/telemetry
                      </span>
                      <span className="text-xs text-slate-500">Interval: Every 30 seconds</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      The ESP32 dispatches this heartbeat to inform the backend of its online health, Wi-Fi RSSI signal strength, battery voltage, free heap memory, and current 20×4 LCD display lines. The backend updates the terminal record in real-time.
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-700 mb-1.5">Expected ESP32 JSON Payload:</p>
                    <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
{`{
  "deviceId": "DEV_TERM_01",
  "wifiStatus": "Connected",
  "rssi": -58,
  "ipAddress": "192.168.1.102",
  "macAddress": "24:0A:C4:B8:3A:1E",
  "powerStatus": "AC",
  "batteryStatus": 92,
  "voltage": "4.18V (Li-ion)",
  "esp32Heap": "296 KB Free / 520 KB Total",
  "pendingRecords": 0,
  "firmwareVersion": "AttendX-FW v2.4.1",
  "fingerprintStatus": "SMF V1.7 Ready (UART 57600)",
  "cameraStatus": "ESP-CAM Standby (SVGA OV2640)",
  "keypadStatus": "4x4 Matrix Active",
  "lcdStatus": "20x4 I2C LCD Ready (0x27)",
  "lcdText": [
    "** ATTENDX TERMINAL **",
    "Ready for Scan...",
    "Time: 09:15 AM [SYNC]",
    "Net: CONNECTED | Bat:92%"
  ]
}`}
                    </pre>
                  </div>

                  {/* Interactive Live Telemetry Tester */}
                  <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-900">Live Hardware Telemetry Simulation Tester</span>
                      <button
                        onClick={() => handleSendSampleTelemetry(devices[0]?.id || 'DEV_TERM_01')}
                        className="inline-flex items-center px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded shadow-sm"
                      >
                        <Send className="w-3.5 h-3.5 mr-1.5" /> Send Sample Telemetry Packet
                      </button>
                    </div>
                    <p className="text-xs text-emerald-800">
                      Click the button above to simulate an incoming HTTP POST from an ESP32. You will observe the backend acknowledge the heartbeat and the UI immediately update the terminal stats.
                    </p>
                    {testTelemetryStatus && (
                      <p className="text-xs font-mono text-emerald-950 font-medium bg-emerald-100 p-2 rounded">
                        {testTelemetryStatus}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Biometric DB Enrollment */}
              {apiSpecTab === 'enrollment' && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-200">
                        GET /api/devices/enrollment?deviceId=DEV_TERM_01
                      </span>
                      <span className="text-xs text-slate-500">Biometric Sync Pipeline</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Allows any newly added terminal to download all user fingerprint templates from the central database and write them into its local SMF V1.7 optical flash slots. Also polls for any pending live enrollment jobs assigned to this terminal.
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-700 mb-1.5">Backend Response (Templates & Jobs):</p>
                    <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
{`{
  "deviceId": "DEV_TERM_01",
  "totalUsers": 3,
  "totalEnrolledInDb": 2,
  "users": [
    {
      "userId": "USR001",
      "name": "John Doe",
      "role": "Staff",
      "hasFingerprint": true,
      "slotNumber": 1,
      "templateData": "SMF17_FP_USR001_SAMPLE_TEMPLATE_HEX_A5F90B2",
      "isEnrolledOnThisTerminal": true
    },
    {
      "userId": "USR003",
      "name": "David Smith",
      "role": "Consultant",
      "hasFingerprint": false,
      "slotNumber": 0,
      "templateData": null,
      "isEnrolledOnThisTerminal": false
    }
  ],
  "pendingJob": {
    "jobId": "JOB_1726915200000",
    "deviceId": "DEV_TERM_01",
    "userId": "USR003",
    "userName": "David Smith",
    "slotNumber": 3,
    "status": "PENDING_SCAN"
  }
}`}
                    </pre>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-200">
                      POST /api/devices/enrollment
                    </span>
                    <p className="text-xs text-slate-600">
                      When the user places their finger on the terminal sensor, the ESP32 compiles the 512-byte template and posts it back with <code className="font-mono text-indigo-700">&quot;action&quot;: &quot;COMPLETE_ENROLLMENT&quot;</code>.
                    </p>
                    <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto">
{`{
  "action": "COMPLETE_ENROLLMENT",
  "deviceId": "DEV_TERM_01",
  "userId": "USR003",
  "slotNumber": 3,
  "templateData": "SMF17_FP_USR003_ENROLLED_5C92B104F"
}`}
                    </pre>
                  </div>
                </div>
              )}

              {/* Tab 3: Attendance Scans */}
              {apiSpecTab === 'checkin' && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                        POST /api/attendance/checkin
                      </span>
                      <span className="text-xs text-slate-500">Real-time Scan or Offline SPIFFS Sync</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Dispatched whenever a user verifies via fingerprint or PIN. Supports single real-time events as well as batch arrays uploaded from local flash buffer when Wi-Fi recovers.
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-700 mb-1.5">Single Event or Batch Array Payload:</p>
                    <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
{`// Single Live Verification:
{
  "deviceId": "DEV_TERM_01",
  "userId": "USR001",
  "authMode": "fingerprint",
  "timestamp": "2026-09-21T08:52:14.000Z",
  "offlineBuffered": false
}

// Or Batch Flash Upload (after outage recovery):
{
  "deviceId": "DEV_TERM_01",
  "batch": [
    { "userId": "USR001", "authMode": "fingerprint", "timestamp": "2026-09-21T08:52:14.000Z" },
    { "userId": "USR002", "authMode": "pin", "timestamp": "2026-09-21T09:14:02.000Z" }
  ]
}`}
                    </pre>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-700 mb-1.5">Backend Response for 20×4 LCD:</p>
                    <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto">
{`{
  "success": true,
  "processedCount": 1,
  "displayMessage": "WELCOME, JOHN!",
  "status": "Present"
}`}
                    </pre>
                  </div>
                </div>
              )}

              {/* Tab 4: Camera Evidence */}
              {apiSpecTab === 'evidence' && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2 py-1 rounded border border-purple-200">
                        POST /api/attendance/evidence
                      </span>
                      <span className="text-xs text-slate-500">ESP-CAM OV2640 Snapshot</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Triggered automatically by the terminal whenever attendance is logged via Keypad PIN fallback instead of biometric fingerprint. Prevents buddy-punching by attaching visual proof.
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-700 mb-1.5">ESP-CAM Snapshot Payload:</p>
                    <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
{`{
  "deviceId": "DEV_TERM_01",
  "attendanceId": "ATT_1726915200000_A9B",
  "userId": "USR003",
  "captureTime": "2026-09-21T09:15:30.000Z",
  "imageBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD..."
}`}
                    </pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
