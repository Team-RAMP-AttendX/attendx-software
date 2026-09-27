import { NextResponse } from 'next/server';
import { readDb, saveDeviceDoc, getPendingCommandsForDevice } from '@/lib/db';
import { Device } from '@/types';

export async function POST(req: Request) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: 'Request body must be valid JSON' }, { status: 400 });
    }

    const rawDeviceId = body.deviceId || body.device_id || body.terminalId || body.terminal_id;
    if (!rawDeviceId) {
      return NextResponse.json({ ok: false, error: 'deviceId is required in telemetry payload' }, { status: 400 });
    }

    const cleanId = String(rawDeviceId).trim().toUpperCase();
    const wifiStatus = body.wifiStatus || body.wifi_status || 'Connected';
    const rssi = typeof body.rssi === 'number' ? body.rssi : (body.rssi ? Number(body.rssi) : -55);
    const ipAddress = body.ipAddress || body.ip_address || body.ip || '192.168.1.100';
    const macAddress = body.macAddress || body.mac_address || body.mac || '24:0A:C4:00:00:01';
    const powerStatus = body.powerStatus || body.power_status || body.power || 'AC';
    const rawBattery = body.batteryStatus ?? body.battery_status ?? body.battery;
    const batteryStatus = typeof rawBattery === 'number' ? rawBattery : (rawBattery ? Number(rawBattery) : 90);
    const voltage = body.voltage || '4.15V (Li-ion)';
    const esp32Heap = body.esp32Heap || body.esp32_heap || body.freeHeap || body.heap || '285 KB Free / 520 KB Total';
    const rawPending = body.pendingRecords ?? body.pending_records;
    const pendingRecords = typeof rawPending === 'number' ? rawPending : (rawPending ? Number(rawPending) : 0);
    const lcdText = body.lcdText || body.lcd_text;
    const firmwareVersion = body.firmwareVersion || body.firmware_version || 'AttendX-FW v2.4.1';
    const fingerprintStatus = body.fingerprintStatus || body.fingerprint_status || 'DY50 Ready (UART 57600)';
    const cameraStatus = body.cameraStatus || body.camera_status || 'ESP32-S3-CAM Standby (SVGA OV2640)';
    const keypadStatus = body.keypadStatus || body.keypad_status || '4x4 Matrix Active (50ms debounce)';
    const lcdStatus = body.lcdStatus || body.lcd_status || '20x4 I2C LCD Ready (0x27)';
    const rawMax = body.maxSlots ?? body.max_slots;
    const maxSlots = typeof rawMax === 'number' ? rawMax : (rawMax ? Number(rawMax) : 300);
    const rawEnrolled = body.enrolledFingerprints ?? body.enrolled_fingerprints;
    const enrolledFingerprints = typeof rawEnrolled === 'number' ? rawEnrolled : (rawEnrolled ? Number(rawEnrolled) : undefined);
    const rawFree = body.freeSlots ?? body.free_slots;
    const freeSlots = typeof rawFree === 'number' ? rawFree : (rawFree ? Number(rawFree) : undefined);

    const now = new Date().toISOString();
    const db = await readDb();
    const existingDev = db.devices.find(d => d.id === cleanId);

    const activeFpCount = db.fingerprints.filter(f => f.status === 'Active' && f.enrolledTerminals?.includes(cleanId)).length;
    const reportedEnrolled = typeof enrolledFingerprints === 'number' ? enrolledFingerprints : (existingDev?.enrolledFingerprints ?? activeFpCount);
    const reportedFree = typeof freeSlots === 'number' ? freeSlots : Math.max(0, maxSlots - reportedEnrolled);

    const updatedDevice: Device = {
      id: cleanId,
      name: existingDev?.name || `AttendX Terminal ${cleanId}`,
      location: existingDev?.location || 'Main Entrance Gate',
      status: (wifiStatus === 'Disconnected' ? 'OFFLINE' : 'ONLINE'),
      wifiStatus: wifiStatus || 'Connected',
      rssi,
      ipAddress,
      macAddress,
      powerStatus,
      batteryStatus,
      voltage,
      esp32Heap,
      pendingRecords,
      lcdText: lcdText || existingDev?.lcdText || [
        '** ATTENDX TERMINAL **',
        'Ready for Scan...',
        'System: ONLINE',
        'Net: CONNECTED'
      ],
      firmwareVersion,
      fingerprintStatus,
      cameraStatus,
      keypadStatus,
      lcdStatus,
      maxSlots,
      enrolledFingerprints: reportedEnrolled,
      freeSlots: reportedFree,
      lastSync: now
    };

    // Save ONLY the single device doc directly to Firestore (instant sub-50ms execution!)
    await saveDeviceDoc(updatedDevice);

    // Retrieve pending commands for this terminal (§2.1 of Contract)
    const pendingCommands = await getPendingCommandsForDevice(cleanId);
    
    // Format command payload for ESP32-S3-CAM firmware
    // Include ALL relevant fields so firmware can execute without ambiguity
    const formattedCommands = pendingCommands.slice(0, 3).map(cmd => {
      if (cmd.type === 'ENROLL_FINGERPRINT') {
        return {
          commandId: cmd.commandId,
          type: 'ENROLL_FINGERPRINT' as const,
          userId: cmd.userId,
          slotNumber: cmd.slotNumber  // Required: DY50 EEPROM slot for template storage
        };
      } else if (cmd.type === 'DELETE_FINGERPRINT') {
        return {
          commandId: cmd.commandId,
          type: 'DELETE_FINGERPRINT' as const,
          slotNumber: cmd.slotNumber
        };
      }
      return {
        commandId: cmd.commandId,
        type: cmd.type
      };
    });

    // Adaptive heartbeat: poll faster when commands are pending so dashboard actions feel instant
    const nextHeartbeatSeconds = formattedCommands.length > 0 ? 5 : 30;

    // Resolve device config for firmware
    const deviceConfig = {
      pinFallbackEnabled: existingDev?.pinFallbackEnabled ?? true,
      cameraEvidenceEnabled: existingDev?.cameraEvidenceEnabled ?? true,
      heartbeatIntervalSeconds: existingDev?.heartbeatIntervalSeconds ?? 30
    };

    return NextResponse.json({
      ok: true,
      success: true,
      deviceId: cleanId,
      serverTime: now,
      terminalStatus: 'ACKNOWLEDGED',
      activeEnrolledFingerprints: db.fingerprints.filter(f => f.status === 'Active').length,
      nextHeartbeatIntervalSeconds: nextHeartbeatSeconds,
      config: deviceConfig,
      commands: formattedCommands
    });
  } catch (err) {
    console.error('Error handling telemetry:', err);
    return NextResponse.json({ ok: false, error: 'Failed to process telemetry' }, { status: 500 });
  }
}
