"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  FileText, 
  Download, 
  Printer, 
  Cpu, 
  Layers, 
  Radio, 
  Fingerprint, 
  CheckCircle2, 
  Camera, 
  Hash, 
  Code, 
  Copy, 
  Check, 
  ArrowRight,
  ShieldAlert,
  HardDrive
} from 'lucide-react'
import { generateContractPdf } from '@/lib/generateContractPdf'

export default function ContractBlueprintPage() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  const handleDownloadPdf = () => {
    setDownloadingPdf(true)
    try {
      const doc = generateContractPdf()
      doc.save('AttendX_Firmware_Backend_Handshake_Blueprint_v2.4.pdf')
    } catch (err) {
      console.error('Error generating PDF:', err)
    } finally {
      setDownloadingPdf(false)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedSection(id)
    setTimeout(() => setCopiedSection(null), 2500)
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Top Header & Actions Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl text-white shadow-xl border border-slate-800">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/30 text-indigo-300 border border-indigo-500/40">
              Protocol v2.4.1 Specification
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/30 text-emerald-300 border border-emerald-500/40">
              Approved Single Source of Truth
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Firmware & Backend Handshake Blueprint
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
            Official technical contract defining the single canonical JSON endpoints, UART & I2C hardware pinouts, 
            telemetry heartbeats, and biometric slot allocation handshake for the ESP32 AttendX terminal.
          </p>
        </div>

        <div className="flex items-center space-x-3 flex-shrink-0">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold border border-slate-700 shadow-sm flex items-center transition-all"
            title="Print or Save via Browser"
          >
            <Printer className="w-4 h-4 mr-1.5 text-slate-300" />
            Print
          </button>
          
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center transition-all"
          >
            <Download className="w-4 h-4 mr-2" />
            {downloadingPdf ? 'Generating PDF...' : 'Download Official PDF'}
          </button>
        </div>
      </div>

      {/* Grid: Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Main MCU</p>
              <p className="text-sm font-bold text-slate-800">ESP32 NodeMCU-32S</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Biometric Sensor</p>
              <p className="text-sm font-bold text-slate-800">DY50 Optical (UART)</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center space-x-3">
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Keypad Matrix</p>
              <p className="text-sm font-bold text-slate-800">4x4 Matrix (0-9 + A-D)</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center space-x-3">
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Evidence Capture</p>
              <p className="text-sm font-bold text-slate-800">ESP32-S3-CAM (OV2640)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section 1: Pinout Mapping */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4 bg-slate-50/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-600"></div>
              <CardTitle className="text-base font-bold text-slate-900">
                1. Hardware Pinout & Peripheral Configuration
              </CardTitle>
            </div>
            <span className="text-xs font-mono text-slate-400">Wiring Spec</span>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="p-3">Subsystem</th>
                  <th className="p-3">Module Component</th>
                  <th className="p-3">ESP32 Pinout</th>
                  <th className="p-3">Protocol / Baud</th>
                  <th className="p-3">Functional Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                <tr>
                  <td className="p-3 font-bold text-emerald-700">Biometrics</td>
                  <td className="p-3">DY50 Optical Sensor</td>
                  <td className="p-3 font-mono text-indigo-700">TX=GPIO 16, RX=GPIO 17</td>
                  <td className="p-3">UART (57600 baud)</td>
                  <td className="p-3">Captures 500 DPI ridge map, compares templates against internal 300 EEPROM slots.</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-blue-700">Matrix Keypad</td>
                  <td className="p-3">4x4 Membrane Switch</td>
                  <td className="p-3 font-mono text-indigo-700">R: 13,12,14,27 | C: 26,25,33,32</td>
                  <td className="p-3">GPIO Active-Low</td>
                  <td className="p-3">50ms debounce; digits 0-9 for ID entry, keys A/B/C/D for role flags, # to enter, * to clear.</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-amber-700">Alphanumeric LCD</td>
                  <td className="p-3">20x4 I2C LCD (HD44780)</td>
                  <td className="p-3 font-mono text-indigo-700">SDA=GPIO 21, SCL=GPIO 22</td>
                  <td className="p-3">I2C (0x27 / 100 kHz)</td>
                  <td className="p-3">Shows live greeting, network status, battery level, and interactive enrollment instructions.</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-purple-700">Optical Evidence</td>
                  <td className="p-3">ESP32-CAM (OV2640)</td>
                  <td className="p-3 font-mono text-indigo-700">TX=GPIO 1, RX=GPIO 3 / WiFi</td>
                  <td className="p-3">UART / HTTP POST</td>
                  <td className="p-3">Snapshots user upon PIN entry; uploads JPEG multipart form to cloud evidence vault.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Biometric Enrollment Handshake & Dynamic Slot Allocation */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4 bg-emerald-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-600"></div>
              <CardTitle className="text-base font-bold text-slate-900">
                2. Biometric Fingerprint Enrollment Handshake (Auto-Slot Allocation)
              </CardTitle>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
              Zero-Collision Protocol
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <p className="text-xs text-slate-600 leading-relaxed">
            The enrollment pipeline coordinates EEPROM slot allocation automatically 
            (<code className="font-mono text-emerald-800 font-bold">nextSlot = maxSlot + 1</code>).
            All steps communicate via single, canonical endpoints.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
              <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-bold inline-flex items-center justify-center text-[10px]">1</span>
              <p className="font-bold text-slate-800">Admin Queues</p>
              <p className="text-[11px] text-slate-500">Dashboard calls <code className="font-mono">POST /api/devices/enrollment</code> with target User ID & auto-assigned Slot #.</p>
            </div>

            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl space-y-1.5">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold inline-flex items-center justify-center text-[10px]">2</span>
              <p className="font-bold text-blue-900">Telemetry Pickup</p>
              <p className="text-[11px] text-blue-800">Terminal polls telemetry heartbeat; receives command in JSON response body.</p>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
              <span className="w-5 h-5 rounded-full bg-amber-600 text-white font-bold inline-flex items-center justify-center text-[10px]">3</span>
              <p className="font-bold text-amber-900">Sensor Arms</p>
              <p className="text-[11px] text-amber-800">LCD shows <code className="font-mono">** ENROLL MODE **</code>; user touches optical glass twice.</p>
            </div>

            <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl space-y-1.5">
              <span className="w-5 h-5 rounded-full bg-purple-600 text-white font-bold inline-flex items-center justify-center text-[10px]">4</span>
              <p className="font-bold text-purple-900">Report Result</p>
              <p className="text-[11px] text-purple-800">Terminal posts completion report to <code className="font-mono">POST /api/devices/commands/result</code>.</p>
            </div>

            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold inline-flex items-center justify-center text-[10px]">5</span>
              <p className="font-bold text-emerald-900">Confirmed!</p>
              <p className="text-[11px] text-emerald-800">Backend marks command COMPLETED & saves active fingerprint; Modal displays &quot;Hardware Confirmed!&quot;.</p>
            </div>
          </div>

          {/* Code comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900 rounded-xl p-4 text-white text-xs space-y-2 border border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-mono text-emerald-400 font-bold">POST /api/devices/commands/result</span>
                <button 
                  onClick={() => copyToClipboard(`{\n  "deviceId": "DEV_TERM_01",\n  "commandId": "cmd_enroll_9k2a",\n  "type": "ENROLL_FINGERPRINT",\n  "status": "success",\n  "userId": "001A",\n  "slotNumber": 3,\n  "timestamp": "2026-09-25T12:00:00.000Z"\n}`, 'cmd_res')}
                  className="text-[10px] text-slate-400 hover:text-white flex items-center space-x-1"
                >
                  {copiedSection === 'cmd_res' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>Copy</span>
                </button>
              </div>
              <pre className="font-mono text-[11px] text-slate-300 overflow-x-auto leading-relaxed">
{`{
  "deviceId": "DEV_TERM_01",
  "commandId": "cmd_enroll_9k2a",
  "type": "ENROLL_FINGERPRINT",
  "status": "success",
  "userId": "001A",
  "slotNumber": 3,
  "timestamp": "2026-09-25T12:00:00.000Z"
}`}
              </pre>
            </div>

            <div className="bg-slate-900 rounded-xl p-4 text-white text-xs space-y-2 border border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-mono text-indigo-400 font-bold">200 OK Command Result Response</span>
                <button 
                  onClick={() => copyToClipboard(`{\n  "ok": true,\n  "ack": true,\n  "success": true,\n  "commandId": "cmd_enroll_9k2a",\n  "status": "success",\n  "slotNumber": 3,\n  "serverTime": "2026-09-25T12:00:01.000Z"\n}`, 'cmd_ack')}
                  className="text-[10px] text-slate-400 hover:text-white flex items-center space-x-1"
                >
                  {copiedSection === 'cmd_ack' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>Copy</span>
                </button>
              </div>
              <pre className="font-mono text-[11px] text-slate-300 overflow-x-auto leading-relaxed">
{`{
  "ok": true,
  "ack": true,
  "success": true,
  "commandId": "cmd_enroll_9k2a",
  "status": "success",
  "slotNumber": 3,
  "serverTime": "2026-09-25T12:00:01.000Z"
}`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Telemetry Heartbeat */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4 bg-slate-50/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-600"></div>
              <CardTitle className="text-base font-bold text-slate-900">
                3. Telemetry Heartbeat & Remote Command Polling
              </CardTitle>
            </div>
            <span className="text-xs font-mono text-slate-500">Every 15-30s</span>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            The ESP32 issues a periodic telemetry ping to the single canonical endpoint <code className="font-mono font-bold text-indigo-700">POST /api/devices/telemetry</code>. 
            The backend updates device liveness and returns any queued commands 
            (such as enrollment) in the response payload.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900 rounded-xl p-4 text-white text-xs space-y-2 border border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-mono text-amber-400 font-bold">Telemetry Request Payload</span>
              </div>
              <pre className="font-mono text-[11px] text-slate-300 overflow-x-auto leading-relaxed">
{`{
  "deviceId": "DEV_TERM_01",
  "wifiStatus": "Connected",
  "rssi": -55,
  "ipAddress": "192.168.1.102",
  "macAddress": "24:0A:C4:B8:3A:1E",
  "powerStatus": "AC",
  "batteryStatus": 88,
  "voltage": "4.18V",
  "esp32Heap": "285 KB Free / 520 KB Total",
  "pendingRecords": 0,
  "maxSlots": 300,
  "enrolledFingerprints": 2
}`}
              </pre>
            </div>

            <div className="bg-slate-900 rounded-xl p-4 text-white text-xs space-y-2 border border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-mono text-emerald-400 font-bold">Telemetry Response & Dispatch</span>
              </div>
              <pre className="font-mono text-[11px] text-slate-300 overflow-x-auto leading-relaxed">
{`{
  "ok": true,
  "success": true,
  "deviceId": "DEV_TERM_01",
  "terminalStatus": "ACKNOWLEDGED",
  "activeEnrolledFingerprints": 2,
  "nextHeartbeatIntervalSeconds": 30,
  "commands": [
    {
      "commandId": "cmd_enroll_9k2a",
      "type": "ENROLL_FINGERPRINT",
      "userId": "001A"
    }
  ]
}`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Live Attendance Check-In & Check-Out */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4 bg-slate-50/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-purple-600"></div>
              <CardTitle className="text-base font-bold text-slate-900">
                4. Real-Time Check-In & Check-Out Handshake
              </CardTitle>
            </div>
            <span className="text-xs font-mono text-slate-500">POST /api/attendance/checkin</span>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            When a user touches the DY50 optical glass or punches their Keypad User ID + PIN on the 4x4 matrix, 
            the terminal sends the event directly to <code className="font-mono font-bold text-indigo-700">POST /api/attendance/checkin</code>.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900 rounded-xl p-4 text-white text-xs space-y-2 border border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-mono text-amber-400 font-bold">Scan Event Payload (ESP32)</span>
              </div>
              <pre className="font-mono text-[11px] text-slate-300 overflow-x-auto leading-relaxed">
{`// Option A: Optical Sensor Match
{
  "deviceId": "DEV_TERM_01",
  "slotNumber": 1,
  "authMode": "fingerprint",
  "timestamp": 1727280120
}

// Option B: Keypad Matrix Entry
{
  "deviceId": "DEV_TERM_01",
  "userId": "001A",
  "authMode": "pin",
  "timestamp": 1727280120
}`}
              </pre>
            </div>

            <div className="bg-slate-900 rounded-xl p-4 text-white text-xs space-y-2 border border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-mono text-emerald-400 font-bold">201 Created Response (with LCD text)</span>
              </div>
              <pre className="font-mono text-[11px] text-slate-300 overflow-x-auto leading-relaxed">
{`{
  "ok": true,
  "success": true,
  "eventType": "CHECK_IN",
  "userId": "001A",
  "userName": "John Doe",
  "userRole": "Student",
  "status": "Present",
  "isLate": false,
  "displayMessage": "WELCOME, JOHN!",
  "checkInTime": "2026-09-25T08:42:00.000Z",
  "serverTime": "2026-09-25T08:42:01.000Z"
}`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
