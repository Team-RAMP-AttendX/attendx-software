import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export function generateContractPdf(): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor: [number, number, number] = [30, 41, 59]; // slate-800
  const accentColor: [number, number, number] = [79, 70, 229]; // indigo-600
  const emeraldColor: [number, number, number] = [16, 185, 129]; // emerald-600

  // Helper for page headers and footers
  const addHeaderFooter = (currentPage: number, totalPages: number) => {
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('AttendX™ IoT Biometric Smart Attendance System — Consolidated Technical Specification', 14, 10);
    doc.text(`Page ${currentPage} of ${totalPages}`, 196, 10, { align: 'right' });
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 12, 196, 12);

    doc.line(14, 285, 196, 285);
    doc.text('CONFIDENTIAL & PROPRIETARY — ATTENDX FIRMWARE & BACKEND REVISION v2.4.1', 14, 290);
    doc.text('© 2026 AttendX Systems LLC', 196, 290, { align: 'right' });
  };

  // ==========================================
  // PAGE 1: TITLE, SCOPE & PINOUT MAP
  // ==========================================
  doc.setFillColor(...primaryColor);
  doc.rect(14, 16, 182, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('ATTENDX™ IOT FIRMWARE & BACKEND BLUEPRINT', 20, 26);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(199, 210, 254);
  doc.text('Authoritative Technical Handshake Specification & Single Source of Truth', 20, 34);
  doc.text('Target Hardware: ESP32 NodeMCU-32S • Sensor: DY50 Optical (UART) • Matrix: 4x4 Keypad • LCD: I2C 20x4', 20, 39);

  let y = 50;

  doc.setTextColor(...primaryColor);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('1. EXECUTIVE ARCHITECTURE OVERVIEW', 14, y);
  y += 6;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const overviewText = 
    'This document defines the single authoritative communication standard between the AttendX cloud backend ' +
    'and the physical ESP32 attendance terminal firmware. The terminal operates as an intelligent edge controller ' +
    'capable of real-time telemetry polling, optical fingerprint verification (DY50 via UART 57600 baud), ' +
    '4x4 matrix keypad input, ESP32-CAM photo evidence streaming, and offline transaction buffering in non-volatile flash. ' +
    'All communications use single, canonical JSON endpoints without ambiguous aliases.';
  doc.text(doc.splitTextToSize(overviewText, 182), 14, y);
  y += 20;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('2. HARDWARE PINOUT & PERIPHERAL MAPPING', 14, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [['Subsystem', 'Component / Sensor', 'ESP32 GPIO Pins', 'Protocol / Baud', 'Operational Logic']],
    body: [
      ['Biometrics', 'DY50 Optical Sensor', 'TX=GPIO 16, RX=GPIO 17', 'UART (57600 baud)', '500 DPI optical scan; 300 EEPROM template capacity.'],
      ['Keypad', '4x4 Membrane Matrix', 'Rows: 13,12,14,27 | Cols: 26,25,33,32', 'GPIO Matrix (Active Low)', 'Debounce 50ms; digits 0-9 for ID, A/B/C/D for role flags.'],
      ['Display', '20x4 I2C Character LCD', 'SDA=GPIO 21, SCL=GPIO 22', 'I2C (0x27 / 100kHz)', 'Real-time state display, welcome/farewell messages, clock.'],
      ['Camera', 'ESP32-S3-CAM (OV2640)', 'TX=GPIO 1, RX=GPIO 3 / WiFi', 'UART / HTTP multipart', 'Captures SVGA JPEG snapshot on PIN keypad entry.'],
      ['Audio/Visual', 'Active Buzzer & Dual LEDs', 'Buzzer=GPIO 4, Green=18, Red=19', 'Digital Output', 'Short beep on scan; continuous tone on unmapped user.']
    ],
    headStyles: { fillColor: accentColor, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 }
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('3. USER ID STANDARD & KEYPAD MATRIX SCHEMA', 14, y);
  y += 6;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const keypadDesc = 
    'All User IDs in the AttendX ecosystem follow the hardware-friendly Keypad Matrix Standard: ' +
    'Digits [0-9] followed by a single letter [A-D] matching the 4x4 matrix rightmost column. ' +
    'Suffix [A] denotes Student, [B] denotes Staff, and [C] denotes Admin (e.g. 001A, 002B, 105A). ' +
    'When punching an ID on the physical terminal, pressing "#" commits the buffer; pressing "*" clears it.';
  doc.text(doc.splitTextToSize(keypadDesc, 182), 14, y);

  // ==========================================
  // PAGE 2: ENROLLMENT HANDSHAKE & SLOT ALLOCATION
  // ==========================================
  doc.addPage();
  y = 20;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('4. BIOMETRIC ENROLLMENT HANDSHAKE & AUTO-SLOT ALLOCATION', 14, y);
  y += 6;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const enrollText = 
    'Enrollment is coordinated seamlessly between cloud Firestore and terminal EEPROM flash. ' +
    'The backend dynamically calculates the next free slot (e.g. Slot #1, #2, #3...) avoiding collisions. ' +
    'All command lifecycle events use unambiguous canonical endpoints.';
  doc.text(doc.splitTextToSize(enrollText, 182), 14, y);
  y += 12;

  autoTable(doc, {
    startY: y,
    head: [['Step', 'Initiator', 'Canonical Endpoint', 'Payload / Event', 'Status Transition']],
    body: [
      ['1', 'Admin / UI', 'POST /api/devices/enrollment', '{"action":"QUEUE_ENROLLMENT","deviceId":"DEV_TERM_01","userId":"001A","slotNumber":3}', 'Creates PENDING command in Firestore'],
      ['2', 'ESP32 Terminal', 'POST /api/devices/telemetry', 'Terminal sends telemetry heartbeat packet', 'Backend marks command DISPATCHED; returns command in JSON'],
      ['3', 'Terminal Hardware', 'Local DY50 UART', 'LCD shows "** ENROLL MODE **"; sensor LED blinks blue', 'User places finger twice on optical sensor glass'],
      ['4', 'ESP32 Terminal', 'POST /api/devices/commands/result', '{"deviceId":"DEV_TERM_01","commandId":"cmd_...","type":"ENROLL_FINGERPRINT","status":"success","userId":"001A","slotNumber":3}', 'Backend marks command COMPLETED; saves active fingerprint in DB'],
      ['5', 'Dashboard Modal', 'GET /api/devices/enrollment', 'Polls jobId every 2 seconds', 'Modal receives COMPLETED and shows green "Hardware Confirmed!"']
    ],
    headStyles: { fillColor: emeraldColor, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [240, 253, 244] },
    margin: { left: 14, right: 14 }
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('5. TELEMETRY & COMMAND POLLING (HEARTBEAT)', 14, y);
  y += 6;

  doc.setFontSize(8);
  doc.setFont('courier', 'normal');
  doc.setTextColor(30, 41, 59);

  const telemetryReq = 
    'CANONICAL ENDPOINT: POST /api/devices/telemetry\n' +
    'REQUEST PAYLOAD (ESP32 -> Backend):\n' +
    '{\n' +
    '  "deviceId": "DEV_TERM_01",\n' +
    '  "wifiStatus": "Connected",\n' +
    '  "rssi": -58,\n' +
    '  "ipAddress": "192.168.1.102",\n' +
    '  "macAddress": "24:0A:C4:B8:3A:1E",\n' +
    '  "powerStatus": "AC",\n' +
    '  "batteryStatus": 88,\n' +
    '  "voltage": "4.15V",\n' +
    '  "esp32Heap": "285 KB Free / 520 KB Total",\n' +
    '  "pendingRecords": 0,\n' +
    '  "firmwareVersion": "AttendX-FW v2.4.1",\n' +
    '  "fingerprintStatus": "DY50 Ready (UART 57600)",\n' +
    '  "maxSlots": 300,\n' +
    '  "enrolledFingerprints": 2\n' +
    '}';
  doc.text(telemetryReq, 14, y);

  const telemetryRes = 
    'RESPONSE PAYLOAD (Backend -> ESP32):\n' +
    '{\n' +
    '  "ok": true,\n' +
    '  "success": true,\n' +
    '  "deviceId": "DEV_TERM_01",\n' +
    '  "serverTime": "2026-09-25T12:00:00.000Z",\n' +
    '  "terminalStatus": "ACKNOWLEDGED",\n' +
    '  "nextHeartbeatIntervalSeconds": 30,\n' +
    '  "commands": [\n' +
    '    {\n' +
    '      "commandId": "cmd_enroll_9k2a",\n' +
    '      "type": "ENROLL_FINGERPRINT",\n' +
    '      "userId": "001A"\n' +
    '    }\n' +
    '  ]\n' +
    '}';
  doc.text(telemetryRes, 110, y);

  // ==========================================
  // PAGE 3: CHECK-IN / CHECK-OUT & BUFFER REPLAY
  // ==========================================
  doc.addPage();
  y = 20;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('6. REAL-TIME CHECK-IN & CHECK-OUT HANDSHAKE', 14, y);
  y += 6;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const checkinDesc = 
    'When a user scans their fingerprint (DY50 optical) or inputs their Keypad User ID + PIN, ' +
    'the terminal immediately transmits the transaction to the canonical endpoint POST /api/attendance/checkin. ' +
    'The backend automatically evaluates attendance direction (IN vs OUT), late thresholds (9:00 AM), ' +
    'updates Firestore records, and returns LCD display text for the terminal.';
  doc.text(doc.splitTextToSize(checkinDesc, 182), 14, y);
  y += 14;

  autoTable(doc, {
    startY: y,
    head: [['Field Name', 'Type', 'Required', 'Description & Accepted Format']],
    body: [
      ['deviceId', 'string', 'Yes', 'Physical terminal ID (e.g. "DEV_TERM_01", "DEV_TERM_02").'],
      ['slotNumber', 'number', 'Conditional', 'DY50 EEPROM slot (1-300). Used if authMode is "fingerprint".'],
      ['userId', 'string', 'Conditional', 'Keypad User ID (e.g. "001A", "002B"). Required for PIN mode.'],
      ['authMode', 'string', 'Yes', '"fingerprint" or "pin". Defaults to fingerprint if slotNumber present.'],
      ['direction', 'string', 'Optional', '"IN" or "OUT". If omitted, backend toggles based on daily state.'],
      ['timestamp', 'number/string', 'Optional', 'Unix epoch (seconds or ms) or ISO string from terminal RTC.'],
      ['offlineBuffered', 'boolean', 'Optional', 'Set to true when replaying buffered logs after network restore.']
    ],
    headStyles: { fillColor: accentColor, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 }
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('7. OFFLINE STORAGE & BURST REPLAY SPECIFICATION', 14, y);
  y += 6;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const replayDesc = 
    'During internet outages, the ESP32 buffers all scans in SPIFFS/LittleFS. Upon Wi-Fi reconnection, ' +
    'the terminal transmits buffered transactions in a single array payload to the canonical endpoint POST /api/sync/replay. ' +
    'The backend processes the batch chronologically and returns 201 Created with synchronization status.';
  doc.text(doc.splitTextToSize(replayDesc, 182), 14, y);
  y += 12;

  doc.setFontSize(8);
  doc.setFont('courier', 'normal');
  doc.setTextColor(30, 41, 59);

  const batchPayload = 
    'BATCH REPLAY PAYLOAD (ESP32 -> POST /api/sync/replay):\n' +
    '[\n' +
    '  {\n' +
    '    "deviceId": "DEV_TERM_01",\n' +
    '    "slotNumber": 1,\n' +
    '    "userId": "001A",\n' +
    '    "authMode": "fingerprint",\n' +
    '    "timestamp": 1727280120,\n' +
    '    "offlineBuffered": true\n' +
    '  },\n' +
    '  {\n' +
    '    "deviceId": "DEV_TERM_01",\n' +
    '    "userId": "002B",\n' +
    '    "authMode": "pin",\n' +
    '    "timestamp": 1727281450,\n' +
    '    "offlineBuffered": true\n' +
    '  }\n' +
    ']';
  doc.text(batchPayload, 14, y);

  const batchResponse = 
    'BATCH RESPONSE (Backend -> ESP32):\n' +
    '{\n' +
    '  "ok": true,\n' +
    '  "success": true,\n' +
    '  "processedCount": 2,\n' +
    '  "displayMessage": "SYNCED: 2 SCANS",\n' +
    '  "serverTime": "2026-09-25T12:05:00.000Z",\n' +
    '  "records": [\n' +
    '    { "id": "ATT_01", "userId": "001A", "status": "Present" },\n' +
    '    { "id": "ATT_02", "userId": "002B", "status": "Present" }\n' +
    '  ]\n' +
    '}';
  doc.text(batchResponse, 110, y);

  // ==========================================
  // PAGE 4: ARDUINO C++ ESP32 REFERENCE DRIVER
  // ==========================================
  doc.addPage();
  y = 20;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('8. ESP32 FIRMWARE REFERENCE IMPLEMENTATION (C++)', 14, y);
  y += 6;

  doc.setFontSize(7.5);
  doc.setFont('courier', 'normal');
  doc.setTextColor(30, 41, 59);

  const cppCode = 
    '#include <WiFi.h>\n' +
    '#include <HTTPClient.h>\n' +
    '#include <ArduinoJson.h>\n' +
    '#include <Adafruit_Fingerprint.h>\n' +
    '#include <LiquidCrystal_I2C.h>\n\n' +
    'const char* SERVER_URL = "https://your-attendx-domain.app";\n' +
    'const char* DEVICE_ID  = "DEV_TERM_01";\n\n' +
    '// 1. Send Heartbeat & Check for Remote Commands\n' +
    'void sendTelemetryHeartbeat() {\n' +
    '  if (WiFi.status() != WL_CONNECTED) return;\n' +
    '  HTTPClient http;\n' +
    '  http.begin(String(SERVER_URL) + "/api/devices/telemetry");\n' +
    '  http.addHeader("Content-Type", "application/json");\n\n' +
    '  StaticJsonDocument<512> doc;\n' +
    '  doc["deviceId"] = DEVICE_ID;\n' +
    '  doc["wifiStatus"] = "Connected";\n' +
    '  doc["rssi"] = WiFi.RSSI();\n' +
    '  doc["esp32Heap"] = String(ESP.getFreeHeap() / 1024) + " KB Free";\n' +
    '  String jsonStr;\n' +
    '  serializeJson(doc, jsonStr);\n\n' +
    '  int code = http.POST(jsonStr);\n' +
    '  if (code == 200) {\n' +
    '    StaticJsonDocument<1024> res;\n' +
    '    deserializeJson(res, http.getString());\n' +
    '    JsonArray cmds = res["commands"].as<JsonArray>();\n' +
    '    for (JsonObject cmd : cmds) {\n' +
    '      if (cmd["type"] == "ENROLL_FINGERPRINT") {\n' +
    '        executeEnrollment(cmd["commandId"].as<String>(), cmd["userId"].as<String>());\n' +
    '      }\n' +
    '    }\n' +
    '  }\n' +
    '  http.end();\n' +
    '}\n\n' +
    '// 2. Report Enrollment Result Back to Backend\n' +
    'void reportEnrollmentResult(String cmdId, String userId, int slot, bool ok, String err) {\n' +
    '  HTTPClient http;\n' +
    '  http.begin(String(SERVER_URL) + "/api/devices/commands/result");\n' +
    '  http.addHeader("Content-Type", "application/json");\n\n' +
    '  StaticJsonDocument<384> doc;\n' +
    '  doc["deviceId"] = DEVICE_ID;\n' +
    '  doc["commandId"] = cmdId;\n' +
    '  doc["type"] = "ENROLL_FINGERPRINT";\n' +
    '  doc["status"] = ok ? "success" : "error";\n' +
    '  doc["userId"] = userId;\n' +
    '  doc["slotNumber"] = slot;\n' +
    '  if (!ok) doc["errorReason"] = err;\n\n' +
    '  String payload;\n' +
    '  serializeJson(doc, payload);\n' +
    '  http.POST(payload);\n' +
    '  http.end();\n' +
    '}\n\n' +
    '// 3. Dispatch Live Attendance Scan\n' +
    'void sendAttendanceScan(int slotNumber, String userId, const char* mode) {\n' +
    '  if (WiFi.status() != WL_CONNECTED) { bufferOfflineScan(slotNumber, userId, mode); return; }\n' +
    '  HTTPClient http;\n' +
    '  http.begin(String(SERVER_URL) + "/api/attendance/checkin");\n' +
    '  http.addHeader("Content-Type", "application/json");\n\n' +
    '  StaticJsonDocument<256> doc;\n' +
    '  doc["deviceId"] = DEVICE_ID;\n' +
    '  doc["slotNumber"] = slotNumber;\n' +
    '  doc["userId"] = userId;\n' +
    '  doc["authMode"] = mode;\n' +
    '  String payload;\n' +
    '  serializeJson(doc, payload);\n' +
    '  int code = http.POST(payload);\n' +
    '  http.end();\n' +
    '}';
  doc.text(cppCode, 14, y);

  // Apply page numbers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addHeaderFooter(i, totalPages);
  }

  return doc;
}
