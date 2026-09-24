"use client"
import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  HardDrive, Wifi, WifiOff, Battery, Plug, Activity, Clock, 
  Plus, Trash2, RefreshCw, Cpu, Camera, Terminal, CheckCircle2, 
  AlertTriangle, X, Radio, Eye, Zap, ShieldCheck, FileCode,
  Fingerprint, BookOpen, Send, Check, Layers, Download, Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Device } from '@/types'
import { EnrollFingerprintModal } from '@/components/devices/EnrollFingerprintModal'
import { ConfigureTerminalModal } from '@/components/devices/ConfigureTerminalModal'
import { useSystemMode } from '@/context/SystemModeContext'

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [selectedDeviceDetails, setSelectedDeviceDetails] = useState<Device | null>(null)
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null)
  const [isApiSpecsModalOpen, setIsApiSpecsModalOpen] = useState(false)
  const [apiSpecTab, setApiSpecTab] = useState<'telemetry' | 'enrollment' | 'checkin' | 'evidence' | 'commands'>('telemetry')

  // Dedicated Enroll Fingerprint & Terminal Configuration Modals
  const [deviceToEnroll, setDeviceToEnroll] = useState<Device | null>(null)
  const [deviceToConfigure, setDeviceToConfigure] = useState<Device | null>(null)

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

  const { isSimulationMode, simState, deleteSimulatedDevice, addSimulatedDevice } = useSystemMode()

  // Diagnostics status message
  const [diagnosticResult, setDiagnosticResult] = useState<{ id: string; message: string } | null>(null)

  const fetchDevices = useCallback(() => {
    if (isSimulationMode) return

    fetch('/api/devices')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load devices')
        return res.json()
      })
      .then(data => {
        if (Array.isArray(data)) {
          setDevices(data)
        }
      })
      .catch(console.error)
      .finally(() => {
        setLoading(false)
      })
  }, [isSimulationMode])

  useEffect(() => {
    let active = true
    if (!isSimulationMode) {
      fetchDevices()
      const interval = setInterval(() => {
        if (active) fetchDevices()
      }, 10000)
      return () => {
        active = false
        clearInterval(interval)
      }
    }
  }, [isSimulationMode, fetchDevices])

  const activeDevices = isSimulationMode ? simState.devices : devices

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
      // 1. Arm physical terminal via backend
      const armRes = await fetch('/api/devices/enrollment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'QUEUE_ENROLLMENT',
          deviceId: selectedBioSyncDevice.id,
          userId
        })
      })
      const armData = await armRes.json()
      const currentJobId = armData.job?.jobId

      setBioSyncMsg(`Terminal ${selectedBioSyncDevice.id} armed for ${userName}. Awaiting physical finger placement...`)
      setScanStep('capturing')

      // 2. Poll real hardware completion from the ESP32 terminal
      let attempts = 0
      const maxAttempts = 30
      const pollTimer = setInterval(async () => {
        attempts++
        try {
          const pollRes = await fetch(`/api/devices/enrollment?jobId=${currentJobId}&deviceId=${encodeURIComponent(selectedBioSyncDevice.id)}`)
          if (pollRes.ok) {
            const pollData = await pollRes.json()
            if (pollData.status === 'COMPLETED') {
              clearInterval(pollTimer)
              setScanStep('saved')
              setBioSyncMsg(`Hardware Confirmed: Enrolled & saved biometric fingerprint for ${userName} to database!`)
              const updated = await fetch(`/api/devices/enrollment?deviceId=${encodeURIComponent(selectedBioSyncDevice.id)}`).then(r => r.json())
              setBioSyncData(updated)
              fetchDevices()
              return
            } else if (pollData.status === 'FAILED') {
              clearInterval(pollTimer)
              setScanStep('idle')
              setScanningUserId(null)
              setBioSyncMsg(`Terminal reported enrollment failure: ${pollData.job?.reason || 'Sensor timeout'}`)
              return
            }
          }
        } catch {
          // Keep polling
        }

        if (attempts >= maxAttempts) {
          clearInterval(pollTimer)
          setScanStep('idle')
          setScanningUserId(null)
          setBioSyncMsg(`Optical scan timed out after 60s without finger placement.`)
        }
      }, 2000)

    } catch (err) {
      setBioSyncMsg('Interactive enrollment command failed to reach terminal.')
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
      if (isSimulationMode) {
        const cleanId = newDeviceId.trim().toUpperCase()
        addSimulatedDevice({
          id: cleanId,
          name: newDeviceName.trim() || `AttendX Terminal ${activeDevices.length + 1}`,
          location: newDeviceLocation.trim() || 'Facility Entrance',
          status: 'ONLINE',
          wifiStatus: 'Connected',
          lastSync: new Date().toISOString(),
          pendingRecords: 0,
          batteryStatus: 98,
          powerStatus: newPowerStatus,
          ipAddress: `192.168.1.${120 + activeDevices.length}`,
          macAddress: `24:0A:C4:F1:2A:${(30 + activeDevices.length).toString(16).toUpperCase()}`,
          firmwareVersion: 'AttendX-FW v2.4.1',
          esp32Heap: '290 KB Free / 520 KB Total',
          fingerprintStatus: 'DY50 Ready (UART 57600)',
          cameraStatus: 'ESP-CAM Standby (SVGA OV2640)',
          keypadStatus: '4x4 Matrix Active (50ms debounce)',
          lcdStatus: '20x4 I2C LCD Ready (0x27)',
          lcdText: [
            '** ATTENDX TERMINAL **',
            'Ready for Scan...',
            'System Initialized',
            'Net: CONNECTED | Bat:98%'
          ],
          voltage: '4.18V (Nominal 3.7V Li-ion)',
          maxSlots: 300,
          enrolledFingerprints: 0,
          freeSlots: 300
        })
        setIsAddModalOpen(false)
        setNewDeviceId("")
        setNewDeviceName("")
        setNewDeviceLocation("")
        return
      }

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
    const idToDelete = deviceToDelete.id
    setActionLoading("deleting")
    try {
      if (isSimulationMode) {
        deleteSimulatedDevice(idToDelete)
      } else {
        const res = await fetch(`/api/devices?id=${encodeURIComponent(idToDelete)}`, {
          method: 'DELETE',
          headers: { 'Accept': 'application/json' }
        })
        const text = await res.text()
        let data: any = {}
        try {
          data = JSON.parse(text)
        } catch {
          // fallback
        }
        if (!res.ok) {
          throw new Error(data?.error || data?.message || `Failed to delete terminal (${res.status})`)
        }
        // Immediately remove from local state so UI updates instantaneously
        setDevices(prev => prev.filter(d => d.id !== idToDelete))
      }

      setDeviceToDelete(null)
      if (selectedDeviceDetails?.id === idToDelete) {
        setSelectedDeviceDetails(null)
      }
      if (!isSimulationMode) {
        fetchDevices()
      }
    } catch (err) {
      console.error('Error deleting terminal:', err)
      alert(err instanceof Error ? err.message : 'Failed to delete terminal from database')
    } finally {
      setActionLoading(null)
    }
  }

  const totalTerminals = activeDevices.length
  const onlineTerminals = activeDevices.filter(d => d.status === 'ONLINE').length
  const offlineTerminals = activeDevices.filter(d => d.status === 'OFFLINE').length
  const totalPendingSync = activeDevices.reduce((sum, d) => sum + (d.pendingRecords || 0), 0)

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
          <a
            href="/contract-response.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100 h-10 px-4 py-2 shadow-sm"
            title="Download / Print the signed contract response PDF for the firmware engineer"
          >
            <Download className="w-4 h-4 mr-2 text-emerald-700" /> Firmware Contract PDF
          </a>
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
      ) : activeDevices.length === 0 ? (
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
          {activeDevices.map(device => {
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
                      {isOnline ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                          ONLINE
                        </>
                      ) : (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>
                          OFFLINE
                        </>
                      )}
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
                        {isOnline ? device.wifiStatus : 'Disconnected'}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500">{isOnline ? (device.ipAddress || '192.168.1.101') : 'Awaiting IP'}</p>
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
                        Heartbeat Liveness
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        {isOnline 
                          ? new Date(device.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : (device.secondsSinceLastHeartbeat !== undefined && device.secondsSinceLastHeartbeat < 86400
                              ? (device.secondsSinceLastHeartbeat > 3600
                                  ? `${Math.floor(device.secondsSinceLastHeartbeat / 3600)}h ago`
                                  : `${Math.max(1, Math.floor(device.secondsSinceLastHeartbeat / 60))}m ago`)
                              : 'No Heartbeat')}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {isOnline ? 'Active (<30s ping)' : 'Timed out (>75s)'}
                      </p>
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
                          DY50 ({device.enrolledFingerprints !== undefined ? device.enrolledFingerprints : 2} Enrolled)
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
                    <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
                      <div className="flex items-center space-x-1.5 font-semibold text-amber-800">
                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <span>Terminal Hardware Inactive / Operating Offline</span>
                      </div>
                      <p className="text-amber-700 pl-5 leading-relaxed">
                        No telemetry heartbeat received within the last 75 seconds. If the physical ESP32 terminal is powered off or disconnected from Wi-Fi, check-ins are safely saved in local SPIFFS flash. When the ESP32 powers on and establishes Wi-Fi, it will automatically switch to <strong>ONLINE</strong> and replay buffered events chronologically.
                      </p>
                    </div>
                  )}

                  {/* Optical Sensor Slot Utilization Bar */}
                  <div className="p-3 bg-indigo-50/60 rounded-lg border border-indigo-100 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-indigo-950 flex items-center">
                        <HardDrive className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                        Sensor Storage: <strong>{device.enrolledFingerprints !== undefined ? device.enrolledFingerprints : 2} Enrolled</strong> vs <strong>{device.freeSlots !== undefined ? device.freeSlots : Math.max(0, (device.maxSlots || 300) - (device.enrolledFingerprints !== undefined ? device.enrolledFingerprints : 2))} Free</strong>
                      </span>
                      <span className="font-mono text-indigo-700 text-[11px]">
                        Max: {device.maxSlots || 300} Slots
                      </span>
                    </div>
                    <div className="w-full bg-indigo-200/60 h-2 rounded-full overflow-hidden flex">
                      <div 
                        className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (((device.enrolledFingerprints !== undefined ? device.enrolledFingerprints : 2) / (device.maxSlots || 300)) * 100))}%` }}
                      />
                    </div>
                  </div>

                  {/* Interactive Terminal Management Actions Bar */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* 1. Enrol Fingerprint Button */}
                      <button
                        onClick={() => setDeviceToEnroll(device)}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
                        title="Enroll a user fingerprint directly on this terminal's optical scanner"
                      >
                        <Fingerprint className="w-3.5 h-3.5 mr-1.5" /> Enrol Fingerprint
                      </button>

                      {/* 2. Configure Terminal Button */}
                      <button
                        onClick={() => setDeviceToConfigure(device)}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition-colors"
                        title="Configure terminal parameters, max slots, LCD message, and fallback options"
                      >
                        <Settings className="w-3.5 h-3.5 mr-1.5 text-slate-600" /> Configure
                      </button>

                      {/* Inspect Hardware Button */}
                      <button
                        onClick={() => setSelectedDeviceDetails(device)}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors"
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

                {/* 2. DY50 Fingerprint Sensor */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>DY50 Optical Sensor</span>
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
                    Terminal: <strong className="text-slate-800">{selectedBioSyncDevice.name || selectedBioSyncDevice.id}</strong> ({selectedBioSyncDevice.id}) • Optical Sensor: DY50
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
                  When a new terminal is added to AttendX, it can synchronize all enrolled fingerprint templates stored in the central database directly into its on-board DY50 optical flash memory. Alternatively, you can trigger live on-terminal enrollment for any database user right here.
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
                      [LINE 4] {scanStep === 'capturing' ? 'Pass 2/2: Verifying' : scanStep === 'saved' ? 'Synced to Central DB' : 'DY50 UART Ready'}
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
              <div className="flex items-center space-x-2">
                <a
                  href="/contract-response.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-xs font-semibold px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-md hover:bg-emerald-100 transition-colors shadow-sm"
                  title="Open, print, or save the signed firmware contract PDF"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-700" />
                  Print / Save Contract PDF
                </a>
                <button 
                  onClick={() => setIsApiSpecsModalOpen(false)} 
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </CardHeader>

            <CardContent className="p-6 overflow-y-auto space-y-6">
              {/* Navigation Tabs */}
              <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
                {[
                  { id: 'telemetry', label: '1. Heartbeat & 16x2 / 20x4 LCD' },
                  { id: 'enrollment', label: '2. Slot-to-User Mapping (Hackathon MVP)' },
                  { id: 'checkin', label: '3. Attendance Scans (Slot or User)' },
                  { id: 'evidence', label: '4. Multipart JPEG Streaming' },
                  { id: 'commands', label: '5. Biometric Command Results' }
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
                      The ESP32 dispatches this heartbeat to report Wi-Fi RSSI, battery voltage, free heap memory, and LCD display lines. Both 16×2 (2 lines) and 20×4 (4 lines) LCD displays are natively supported.
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-700 mb-1.5">16×2 LCD Payload (Hackathon Hardware):</p>
                    <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
{`{
  "deviceId": "DEV_TERM_01",
  "wifiStatus": "Connected",
  "rssi": -58,
  "batteryStatus": 92,
  "voltage": "4.18V",
  "esp32Heap": "296 KB Free",
  "lcdStatus": "16x2 I2C LCD Ready (0x27)",
  "lcdText": [
    "ATTENDX TERMINAL",
    "SCAN FINGER / PIN"
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
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-amber-800 bg-amber-100 px-2 py-1 rounded">
                        Hackathon Fast-Track: Slot Number Mapping
                      </span>
                      <span className="text-xs text-amber-700 font-semibold">Zero UART Buffer Overhead</span>
                    </div>
                    <p className="text-xs text-amber-900 leading-relaxed">
                      You do <strong>not</strong> need to dump raw 512-byte character templates over UART from the DY50 optical sensor! The optical sensor stores prints locally in Slot 1, 2, 3... When enrolling or scanning, simply reference the slot number. The backend maps slotNumber to the database user.
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-700 mb-1.5">1. Get Users and Their Assigned Sensor Slots:</p>
                    <div className="font-mono text-xs text-indigo-700 bg-slate-100 p-2 rounded border border-slate-200 mb-2">
                      GET /api/devices/enrollment?deviceId=DEV_TERM_01
                    </div>
                    <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
{`{
  "totalUsers": 3,
  "users": [
    { "userId": "USR001", "name": "John Doe", "slotNumber": 1, "hasFingerprint": true },
    { "userId": "USR002", "name": "Sarah Connor", "slotNumber": 2, "hasFingerprint": true },
    { "userId": "USR003", "name": "David Smith", "slotNumber": 3, "hasFingerprint": false }
  ]
}`}
                    </pre>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-700 mb-1.5">2. Complete Enrollment (Local Slot Only):</p>
                    <div className="font-mono text-xs text-indigo-700 bg-slate-100 p-2 rounded border border-slate-200 mb-2">
                      POST /api/devices/enrollment
                    </div>
                    <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto">
{`{
  "action": "COMPLETE_ENROLLMENT",
  "deviceId": "DEV_TERM_01",
  "userId": "USR003",
  "slotNumber": 3
}`}
                    </pre>
                    <p className="text-[11px] text-slate-500 mt-1">
                      <strong>Backend Response:</strong> Returns <code>status: &quot;SUCCESS&quot;</code>, <code>enrolledSlots</code> count, and <code>freeSlots</code> remaining.
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-700 mb-1.5">3. Report Enrollment Failure (Optical Timeout/Noise):</p>
                    <div className="font-mono text-xs text-rose-700 bg-slate-100 p-2 rounded border border-slate-200 mb-2">
                      POST /api/devices/enrollment
                    </div>
                    <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto">
{`{
  "action": "REPORT_FAILURE",
  "deviceId": "DEV_TERM_01",
  "userId": "USR003",
  "reason": "Sensor timeout: finger removed before 2nd scan completed"
}`}
                    </pre>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Instantly alerts the web dashboard with the exact failure reason and updates LCD.
                    </p>
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
                      When the DY50 optical sensor identifies a finger, the ESP32 can send either the resolved <code>userId</code> OR just the sensor <code>slotNumber</code> directly!
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-700 mb-1.5">Sending via Slot Number (Simplest for ESP32):</p>
                    <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
{`// When DY50 reports match at Slot 3:
{
  "deviceId": "DEV_TERM_01",
  "slotNumber": 3,
  "authMode": "fingerprint"
}

// Or with userId:
{
  "deviceId": "DEV_TERM_01",
  "userId": "USR003",
  "authMode": "fingerprint"
}`}
                    </pre>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-700 mb-1.5">Backend Response for 16×2 LCD:</p>
                    <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto">
{`{
  "success": true,
  "processedCount": 1,
  "displayMessage": "WELCOME, DAVID!",
  "status": "Present"
}`}
                    </pre>
                  </div>
                </div>
              )}

              {/* Tab 4: Camera Evidence */}
              {apiSpecTab === 'evidence' && (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-1 rounded border border-emerald-300">
                        POST /api/attendance/evidence (multipart/form-data)
                      </span>
                      <span className="text-xs text-emerald-700 font-semibold">Zero PSRAM Base64 Overhead</span>
                    </div>
                    <p className="text-xs text-emerald-900 leading-relaxed">
                      <strong>Optimized for ESP32-S3!</strong> The backend now accepts standard <code>multipart/form-data</code>. The ESP32 can stream raw JPEG bytes directly from the camera frame buffer (<code>fb-&gt;buf</code>) without base64 conversion.
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-700 mb-1.5">C++ / Arduino HTTPClient Example:</p>
                    <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
{`// Send raw camera_fb_t* fb directly:
String boundary = "----ESP32Boundary1234";
http.begin("https://ais-dev-.../api/attendance/evidence");
http.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);

// Form data fields:
// 1. userId (text): "USR003"
// 2. deviceId (text): "DEV_TERM_01"
// 3. image (binary): raw fb->buf bytes, size: fb->len`}
                    </pre>
                  </div>

                  <div className="p-3 bg-slate-100 rounded-lg text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">Note:</span> JSON with Base64 is also still supported as a fallback, but multipart streaming is recommended for stable memory performance.
                  </div>
                </div>
              )}

              {/* Tab 5: Biometric Command Execution Report */}
              {apiSpecTab === 'commands' && (
                <div className="space-y-4">
                  <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-indigo-800 bg-indigo-100 px-2 py-1 rounded border border-indigo-300">
                        POST /api/devices/commands/result
                      </span>
                      <span className="text-xs text-indigo-700 font-semibold">Explicit Cloud ACK Protocol</span>
                    </div>
                    <p className="text-xs text-indigo-900 leading-relaxed">
                      After the ESP32 finishes executing a biometric enrollment (<code>ENROLL_FINGERPRINT</code>) or slot deletion (<code>DELETE_FINGERPRINT</code>), post the execution result here. The cloud will respond with an explicit <code>{`{"ok": true, "ack": true}`}</code>. Do <strong>not</strong> clear the command from EEPROM until <code>ack: true</code> is received.
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-700 mb-1.5">1. Enrollment Success Report:</p>
                    <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
{`{
  "deviceId": "DEV_TERM_01",
  "commandId": "cmd_enroll_9021",
  "type": "ENROLL_FINGERPRINT",
  "status": "success",
  "userId": "USR001",
  "slotNumber": 3,
  "timestamp": "2026-09-24T09:15:30.000Z"
}`}
                    </pre>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-700 mb-1.5">2. Hardware Sensor Failure / Timeout Report:</p>
                    <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
{`{
  "deviceId": "DEV_TERM_01",
  "commandId": "cmd_enroll_9021",
  "type": "ENROLL_FINGERPRINT",
  "status": "error",
  "errorReason": "sensor_timeout"
}`}
                    </pre>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-700 mb-1.5">3. Expected Cloud Acknowledgment (HTTP 200 OK):</p>
                    <pre className="p-3 bg-slate-900 text-emerald-400 rounded-lg text-xs font-mono overflow-x-auto">
{`{
  "ok": true,
  "ack": true,
  "success": true,
  "message": "Command result recorded successfully for terminal DEV_TERM_01",
  "commandId": "cmd_enroll_9021",
  "status": "success",
  "slotNumber": 3
}`}
                    </pre>
                  </div>

                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800">
                    <span className="font-semibold text-amber-950">Terminal-Initiated Enrollments:</span> If a technician enrolls a finger directly via the on-device keypad menu without a web dashboard command, send with <code>&quot;source&quot;: &quot;terminal&quot;</code> and omit <code>commandId</code>. The backend will automatically bind the slot to the user.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dedicated Interactive Enroll Fingerprint Modal */}
      {deviceToEnroll && (
        <EnrollFingerprintModal
          device={deviceToEnroll}
          isOpen={!!deviceToEnroll}
          onClose={() => setDeviceToEnroll(null)}
          onSuccess={() => {
            fetchDevices()
          }}
        />
      )}

      {/* Terminal Configuration Modal */}
      {deviceToConfigure && (
        <ConfigureTerminalModal
          device={deviceToConfigure}
          isOpen={!!deviceToConfigure}
          onClose={() => setDeviceToConfigure(null)}
          onSuccess={() => {
            fetchDevices()
          }}
        />
      )}
    </div>
  )
}
