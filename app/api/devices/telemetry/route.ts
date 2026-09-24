import { NextResponse } from 'next/server';
import { readDb, writeDb, getPendingCommandsForDevice } from '@/lib/db';
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
    const wifiStatus = body.wifiStatus || body.wifi_status;
    const rssi = typeof body.rssi === 'number' ? body.rssi : (body.rssi ? Number(body.rssi) : undefined);
    const ipAddress = body.ipAddress || body.ip_address || body.ip;
    const macAddress = body.macAddress || body.mac_address || body.mac;
    const powerStatus = body.powerStatus || body.power_status || body.power;
    const rawBattery = body.batteryStatus ?? body.battery_status ?? body.battery;
    const batteryStatus = typeof rawBattery === 'number' ? rawBattery : (rawBattery ? Number(rawBattery) : undefined);
    const voltage = body.voltage;
    const esp32Heap = body.esp32Heap || body.esp32_heap || body.freeHeap || body.heap;
    const rawPending = body.pendingRecords ?? body.pending_records;
    const pendingRecords = typeof rawPending === 'number' ? rawPending : (rawPending ? Number(rawPending) : undefined);
    const lcdText = body.lcdText || body.lcd_text;
    const firmwareVersion = body.firmwareVersion || body.firmware_version;
    const fingerprintStatus = body.fingerprintStatus || body.fingerprint_status;
    const cameraStatus = body.cameraStatus || body.camera_status;
    const keypadStatus = body.keypadStatus || body.keypad_status;
    const lcdStatus = body.lcdStatus || body.lcd_status;
    const rawMax = body.maxSlots ?? body.max_slots;
    const maxSlots = typeof rawMax === 'number' ? rawMax : (rawMax ? Number(rawMax) : 300);
    const rawEnrolled = body.enrolledFingerprints ?? body.enrolled_fingerprints;
    const enrolledFingerprints = typeof rawEnrolled === 'number' ? rawEnrolled : (rawEnrolled ? Number(rawEnrolled) : undefined);
    const rawFree = body.freeSlots ?? body.free_slots;
    const freeSlots = typeof rawFree === 'number' ? rawFree : (rawFree ? Number(rawFree) : undefined);

    const db = await readDb();
    const existingIndex = db.devices.findIndex(d => d.id === cleanId);

    const now = new Date().toISOString();

    const reportedMax = typeof maxSlots === 'number' ? maxSlots : 300;
    let reportedEnrolled = typeof enrolledFingerprints === 'number' 
      ? enrolledFingerprints 
      : (existingIndex !== -1 && db.devices[existingIndex].enrolledFingerprints !== undefined ? db.devices[existingIndex].enrolledFingerprints : 2);
    let reportedFree = typeof freeSlots === 'number' ? freeSlots : Math.max(0, reportedMax - (reportedEnrolled || 0));

    if (existingIndex !== -1) {
      // Update existing device telemetry
      db.devices[existingIndex] = {
        ...db.devices[existingIndex],
        status: (wifiStatus === 'Disconnected' ? 'OFFLINE' : 'ONLINE'),
        wifiStatus: wifiStatus || db.devices[existingIndex].wifiStatus,
        rssi: typeof rssi === 'number' ? rssi : db.devices[existingIndex].rssi,
        ipAddress: ipAddress || db.devices[existingIndex].ipAddress,
        macAddress: macAddress || db.devices[existingIndex].macAddress,
        powerStatus: powerStatus || db.devices[existingIndex].powerStatus,
        batteryStatus: typeof batteryStatus === 'number' ? batteryStatus : db.devices[existingIndex].batteryStatus,
        voltage: voltage || db.devices[existingIndex].voltage,
        esp32Heap: esp32Heap || db.devices[existingIndex].esp32Heap,
        pendingRecords: typeof pendingRecords === 'number' ? pendingRecords : db.devices[existingIndex].pendingRecords,
        lcdText: lcdText || db.devices[existingIndex].lcdText,
        firmwareVersion: firmwareVersion || db.devices[existingIndex].firmwareVersion,
        fingerprintStatus: fingerprintStatus || db.devices[existingIndex].fingerprintStatus,
        cameraStatus: cameraStatus || db.devices[existingIndex].cameraStatus,
        keypadStatus: keypadStatus || db.devices[existingIndex].keypadStatus,
        lcdStatus: lcdStatus || db.devices[existingIndex].lcdStatus,
        maxSlots: reportedMax,
        enrolledFingerprints: reportedEnrolled,
        freeSlots: reportedFree,
        lastSync: now
      };
    } else {
      // Auto-register terminal if unknown ESP sends heartbeat
      const newDev: Device = {
        id: cleanId,
        name: `AttendX Terminal ${db.devices.length + 1}`,
        location: 'Newly Discovered Terminal',
        status: (wifiStatus === 'Disconnected' ? 'OFFLINE' : 'ONLINE'),
        wifiStatus: wifiStatus || 'Connected',
        rssi: rssi ?? -60,
        lastSync: now,
        pendingRecords: pendingRecords ?? 0,
        batteryStatus: batteryStatus ?? 90,
        powerStatus: powerStatus || 'AC',
        ipAddress: ipAddress || '192.168.1.150',
        macAddress: macAddress || '24:0A:C4:00:00:01',
        firmwareVersion: firmwareVersion || 'AttendX-FW v2.4.1',
        esp32Heap: esp32Heap || '280 KB Free / 520 KB Total',
        fingerprintStatus: fingerprintStatus || 'DY50 Ready (UART 57600)',
        cameraStatus: cameraStatus || 'ESP-CAM Standby (SVGA OV2640)',
        keypadStatus: keypadStatus || '4x4 Matrix Active (50ms debounce)',
        lcdStatus: lcdStatus || '20x4 I2C LCD Ready (0x27)',
        lcdText: lcdText || [
          '** ATTENDX TERMINAL **',
          'Ready for Scan...',
          'Time: Synced',
          'Net: CONNECTED'
        ],
        voltage: voltage || '4.15V (Nominal 3.7V Li-ion)',
        maxSlots: reportedMax,
        enrolledFingerprints: reportedEnrolled,
        freeSlots: reportedFree
      };
      db.devices.push(newDev);
    }

    await writeDb(db);

    // Check if there are active users enrolled in the system
    const activeFingerprints = db.fingerprints.filter(f => f.status === 'Active');

    // Retrieve any pending commands for this terminal (§2.1 of Contract)
    const pendingCommands = await getPendingCommandsForDevice(cleanId);
    
    // Format command payload for ESP32 firmware
    const formattedCommands = pendingCommands.slice(0, 3).map(cmd => {
      if (cmd.type === 'ENROLL_FINGERPRINT') {
        return {
          commandId: cmd.commandId,
          type: 'ENROLL_FINGERPRINT' as const,
          userId: cmd.userId
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

    return NextResponse.json({
      ok: true,
      success: true,
      deviceId: cleanId,
      serverTime: now,
      terminalStatus: 'ACKNOWLEDGED',
      activeEnrolledFingerprints: activeFingerprints.length,
      nextHeartbeatIntervalSeconds: 30,
      commands: formattedCommands
    });
  } catch (err) {
    console.error('Error handling telemetry:', err);
    return NextResponse.json({ error: 'Failed to process telemetry' }, { status: 500 });
  }
}
