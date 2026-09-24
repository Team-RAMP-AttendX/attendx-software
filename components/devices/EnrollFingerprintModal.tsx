'use client'

import React, { useState, useEffect } from 'react'
import { Device } from '@/types'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { 
  Fingerprint, 
  X, 
  UserCheck, 
  CheckCircle2, 
  AlertCircle, 
  Radio, 
  RefreshCw, 
  Sliders, 
  Layers,
  HardDrive
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface UserOption {
  id: string
  name: string
  role: string
  status: string
  hasFingerprint: boolean
  slotNumber?: number
}

interface EnrollFingerprintModalProps {
  device: Device
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function EnrollFingerprintModal({
  device,
  isOpen,
  onClose,
  onSuccess
}: EnrollFingerprintModalProps) {
  const [users, setUsers] = useState<UserOption[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [targetSlot, setTargetSlot] = useState<number>(1)
  
  // Status tracking
  const [status, setStatus] = useState<'IDLE' | 'ARMING' | 'WAITING_FOR_FINGER' | 'SUCCESS' | 'FAILED'>('IDLE')
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [enrolledResult, setEnrolledResult] = useState<{
    enrolledSlots: number
    freeSlots: number
    maxSlots: number
    slotNumber: number
    userName: string
  } | null>(null)
  const [failureReason, setFailureReason] = useState<string>('')

  // Terminal slot counts
  const maxSlots = device.maxSlots || 300
  const enrolledSlots = device.enrolledFingerprints !== undefined ? device.enrolledFingerprints : 2
  const freeSlots = device.freeSlots !== undefined ? device.freeSlots : Math.max(0, maxSlots - enrolledSlots)

  // Fetch users and find the next free slot
  useEffect(() => {
    if (!isOpen) return

    let isMounted = true

    const loadData = async () => {
      try {
        const res = await fetch(`/api/devices/enrollment?deviceId=${encodeURIComponent(device.id)}`)
        const data = await res.json()
        if (!isMounted) return

        if (data.users) {
          const mappedUsers = data.users.map((u: {
            userId: string
            name: string
            role: string
            hasFingerprint: boolean
            slotNumber?: number
          }) => ({
            id: u.userId,
            name: u.name,
            role: u.role,
            status: 'Active',
            hasFingerprint: u.hasFingerprint,
            slotNumber: u.slotNumber
          }))
          setUsers(mappedUsers)

          // Pick the first user without fingerprint if available
          const firstUnenrolled = mappedUsers.find((u: UserOption) => !u.hasFingerprint)
          if (firstUnenrolled) {
            setSelectedUserId(firstUnenrolled.id)
          } else if (mappedUsers.length > 0) {
            setSelectedUserId(mappedUsers[0].id)
          }

          // Calculate next slot number
          const usedSlots = mappedUsers
            .map((u: UserOption) => u.slotNumber || 0)
            .filter((s: number) => s > 0)
          const nextAvailable = usedSlots.length > 0 ? Math.max(...usedSlots) + 1 : 1
          setTargetSlot(nextAvailable)
        }
      } catch (err) {
        console.error('Error fetching users:', err)
      } finally {
        if (isMounted) setLoadingUsers(false)
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [isOpen, device.id])

  // When selected user changes, auto-suggest slot
  const handleUserChange = (uId: string) => {
    setSelectedUserId(uId)
    const user = users.find(u => u.id === uId)
    if (user?.slotNumber) {
      setTargetSlot(user.slotNumber)
    }
  }

  // Trigger enrollment command to the ESP32 terminal
  const handleTriggerEnrollment = async () => {
    if (!selectedUserId) return

    const selectedUser = users.find(u => u.id === selectedUserId)
    if (!selectedUser) return

    setStatus('ARMING')
    setStatusMessage(`Sending enrollment command to terminal ${device.id}...`)
    setFailureReason('')

    try {
      // Step 1: Queue job for ESP32 and arm the physical terminal
      const armRes = await fetch('/api/devices/enrollment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'QUEUE_ENROLLMENT',
          deviceId: device.id,
          userId: selectedUserId,
          slotNumber: Number(targetSlot)
        })
      })

      if (!armRes.ok) {
        throw new Error('Failed to arm terminal for enrollment.')
      }

      setStatus('WAITING_FOR_FINGER')
      setStatusMessage(`Terminal armed! Waiting for ${selectedUser.name} to place finger on optical sensor (Slot #${targetSlot})...`)

      const armData = await armRes.json()
      const currentJobId = armData.job?.jobId

      setStatus('WAITING_FOR_FINGER')
      setStatusMessage(`Terminal ${device.id} armed! Waiting for physical finger placement on optical sensor (Target Slot #${targetSlot})...`)

      // Poll real job status from terminal
      let attempts = 0
      const maxAttempts = 30 // 60 seconds (every 2s)
      const pollInterval = setInterval(async () => {
        attempts++
        try {
          // Poll terminal enrollment status
          const pollRes = await fetch(`/api/devices/enrollment?jobId=${currentJobId}&deviceId=${encodeURIComponent(device.id)}`)
          if (pollRes.ok) {
            const pollData = await pollRes.json()
            if (pollData.status === 'COMPLETED') {
              clearInterval(pollInterval)
              setStatus('SUCCESS')
              setStatusMessage(`Hardware confirmed! Successfully registered fingerprint for ${selectedUser.name} in Slot #${targetSlot}!`)
              setEnrolledResult({
                enrolledSlots: (device.enrolledFingerprints || 0) + 1,
                freeSlots: Math.max(0, (device.maxSlots || 300) - ((device.enrolledFingerprints || 0) + 1)),
                maxSlots: device.maxSlots || 300,
                slotNumber: Number(targetSlot),
                userName: selectedUser.name
              })
              onSuccess()
              return
            } else if (pollData.status === 'FAILED') {
              clearInterval(pollInterval)
              setStatus('FAILED')
              setFailureReason(pollData.job?.reason || 'Terminal reported scan failure or timeout.')
              return
            }
          }
        } catch {
          // Continue polling
        }

        if (attempts >= maxAttempts) {
          clearInterval(pollInterval)
          if (status === 'WAITING_FOR_FINGER') {
            setStatus('FAILED')
            setFailureReason('Enrollment timed out: No finger placement received from physical ESP32 terminal after 60 seconds.')
          }
        }
      }, 2000)

    } catch (err: unknown) {
      setStatus('FAILED')
      setFailureReason(err instanceof Error ? err.message : 'Error sending enrollment event')
    }
  }

  // Optional emulator button for testing before hardware is plugged in
  const handleSimulateHardwareScan = async () => {
    if (!selectedUserId) return
    const selectedUser = users.find(u => u.id === selectedUserId)
    if (!selectedUser) return

    try {
      const completeRes = await fetch('/api/devices/enrollment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'COMPLETE_ENROLLMENT',
          deviceId: device.id,
          userId: selectedUserId,
          slotNumber: Number(targetSlot)
        })
      })
      const data = await completeRes.json()
      if (data.success && data.status === 'SUCCESS') {
        setStatus('SUCCESS')
        setStatusMessage(`[Test Scan] Enrolled ${selectedUser.name} in Slot #${data.slotNumber}!`)
        setEnrolledResult({
          enrolledSlots: data.enrolledSlots,
          freeSlots: data.freeSlots,
          maxSlots: data.maxSlots,
          slotNumber: data.slotNumber,
          userName: selectedUser.name
        })
        onSuccess()
      } else {
        setStatus('FAILED')
        setFailureReason(data.message || 'Scan simulation failed.')
      }
    } catch {
      setStatus('FAILED')
      setFailureReason('Failed to emulate scan.')
    }
  }

  // Allow tester to report hardware failure response
  const handleSimulateFailure = async () => {
    setStatus('ARMING')
    setStatusMessage('Simulating sensor read failure from terminal...')
    try {
      const res = await fetch('/api/devices/enrollment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REPORT_FAILURE',
          deviceId: device.id,
          userId: selectedUserId,
          reason: 'Sensor read timeout: Finger was removed too quickly or dirty lens'
        })
      })
      const data = await res.json()
      setStatus('FAILED')
      setFailureReason(data.reason || 'Sensor read timeout')
    } catch {
      setStatus('FAILED')
      setFailureReason('Simulated failure error')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <Card className="w-full max-w-xl shadow-2xl border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4 bg-slate-50/80">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-lg">
              <Fingerprint className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-slate-900">
                Enroll Fingerprint on Terminal
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Terminal: <strong className="text-slate-800">{device.name || device.id}</strong> ({device.id})
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Real-time Hardware Slot Capacity Indicator */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 flex items-center">
                <HardDrive className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                Optical Sensor Storage Slots (AS608 / SMF V1.7)
              </span>
              <span className="font-mono text-slate-500">
                Capacity: {maxSlots} Slots
              </span>
            </div>

            {/* Capacity Progress Bar */}
            <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex">
              <div 
                className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (enrolledSlots / maxSlots) * 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-emerald-700 font-medium flex items-center">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                <strong>{enrolledResult ? enrolledResult.enrolledSlots : enrolledSlots}</strong> Enrolled Slots
              </span>
              <span className="text-slate-600 font-medium">
                <strong>{enrolledResult ? enrolledResult.freeSlots : freeSlots}</strong> Free Slots Left
              </span>
            </div>
          </div>

          {/* Form Step: Select User and Slot */}
          {status !== 'SUCCESS' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>1. Select User to Enroll</span>
                  <span className="text-xs font-normal text-slate-500">From Central Database</span>
                </label>
                
                {loadingUsers ? (
                  <div className="p-3 text-xs text-slate-500 bg-slate-50 rounded-lg flex items-center space-x-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Loading database users...</span>
                  </div>
                ) : (
                  <select
                    value={selectedUserId}
                    onChange={(e) => handleUserChange(e.target.value)}
                    disabled={status === 'ARMING' || status === 'WAITING_FOR_FINGER'}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.id}) • {u.role} {u.hasFingerprint ? `[Currently in Slot #${u.slotNumber}]` : '[No Print Registered]'}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    2. Sensor Slot Number
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={maxSlots}
                    value={targetSlot}
                    onChange={(e) => setTargetSlot(Number(e.target.value))}
                    disabled={status === 'ARMING' || status === 'WAITING_FOR_FINGER'}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. 1"
                  />
                  <p className="text-[11px] text-slate-500">
                    Flash index on AS608 optical sensor
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Target Hardware
                  </label>
                  <div className="px-3 py-2 text-xs font-mono bg-slate-100 border border-slate-200 rounded-lg text-slate-700 truncate">
                    {device.id} • {device.ipAddress || '192.168.1.102'}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Firmware will write to UART sensor
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Live Status Indicator */}
          {status === 'ARMING' && (
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center space-x-3">
              <RefreshCw className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
              <div>
                <p className="font-bold">Arming Optical Sensor...</p>
                <p className="text-blue-700 mt-0.5">{statusMessage}</p>
              </div>
            </div>
          )}

          {status === 'WAITING_FOR_FINGER' && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
              <div className="flex items-center space-x-2 font-bold text-amber-950">
                <Radio className="w-4 h-4 text-amber-600 animate-pulse" />
                <span>TERMINAL ARMED: SCAN IN PROGRESS</span>
              </div>
              <p className="text-amber-800 leading-relaxed">
                {statusMessage}
              </p>
              <div className="p-2.5 rounded bg-black/80 font-mono text-[11px] text-emerald-400 border border-emerald-500/30">
                [ESP32 LCD]: ** ENROLL MODE **<br />
                User: {users.find(u => u.id === selectedUserId)?.name.substring(0, 14)}<br />
                Place finger on sensor... Slot #{targetSlot}
              </div>
            </div>
          )}

          {/* Success State */}
          {status === 'SUCCESS' && enrolledResult && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-3">
              <div className="flex items-center space-x-2 font-bold text-emerald-950 text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span>Enrollment Completed Successfully!</span>
              </div>
              <p className="text-emerald-800">
                Biometric fingerprint for <strong>{enrolledResult.userName}</strong> was captured and stored in <strong>Slot #{enrolledResult.slotNumber}</strong> on {device.name || device.id}.
              </p>

              {/* Updated Capacity Report */}
              <div className="grid grid-cols-3 gap-2 bg-white/80 p-3 rounded-lg border border-emerald-200/80 text-center font-mono">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Assigned Slot</div>
                  <div className="text-sm font-bold text-indigo-700">#{enrolledResult.slotNumber}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Enrolled Slots</div>
                  <div className="text-sm font-bold text-emerald-700">{enrolledResult.enrolledSlots}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Free Slots Left</div>
                  <div className="text-sm font-bold text-slate-800">{enrolledResult.freeSlots} / {enrolledResult.maxSlots}</div>
                </div>
              </div>
            </div>
          )}

          {/* Failure State */}
          {status === 'FAILED' && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 space-y-2">
              <div className="flex items-center space-x-2 font-bold text-red-950">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span>Enrollment Failed</span>
              </div>
              <p className="text-red-700">
                {failureReason || 'Terminal optical sensor could not capture valid fingerprint template.'}
              </p>
              <div className="text-[11px] text-red-600 font-medium">
                Recommendation: Clean sensor surface, ensure finger is positioned flat, and retry.
              </div>
            </div>
          )}

          {/* Actions Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            {status === 'IDLE' || status === 'FAILED' ? (
              <>
                <button
                  type="button"
                  onClick={handleSimulateFailure}
                  className="text-xs text-slate-500 hover:text-red-600 underline font-medium"
                  title="Simulate optical sensor read failure to verify dashboard alert"
                >
                  Test Failure Flow
                </button>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleTriggerEnrollment}
                    disabled={!selectedUserId || loadingUsers}
                    className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
                  >
                    <Fingerprint className="w-4 h-4 mr-1.5" />
                    Arm & Enroll Fingerprint
                  </button>
                </div>
              </>
            ) : status === 'SUCCESS' ? (
              <div className="w-full flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setStatus('IDLE')
                    setEnrolledResult(null)
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                >
                  Enroll Another User
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Done
                </button>
              </div>
            ) : status === 'WAITING_FOR_FINGER' || status === 'ARMING' ? (
              <div className="w-full flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleSimulateHardwareScan}
                  className="text-xs text-indigo-600 hover:text-indigo-800 underline font-medium"
                  title="If hardware is not yet connected to WiFi, click here to simulate physical finger placed on sensor"
                >
                  ⚡ Simulate Sensor Scan (Hardware Bypass)
                </button>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
