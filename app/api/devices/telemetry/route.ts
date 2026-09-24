import { NextResponse } from 'next/server';
import { readDb, writeDb, getPendingCommandsForDevice } from '@/lib/db';
import { Device } from '@/types';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      deviceId, 
      wifiStatus, 
      rssi, 
      ipAddress, 
      macAddress, 
      powerStatus, 
      batteryStatus, 
      voltage, 
      esp32Heap, 
      pendingRecords, 
      lcdText, 
      firmwareVersion,
      fingerprintStatus,
      cameraStatus,
      keypadStatus,
      lcdStatus,
      maxSlots,
      freeSlots,
      enrolledFingerprints
    } = body;

    if (!deviceId) {
      return NextResponse.json({ error: 'deviceId is required in telemetry payload' }, { status: 400 });
    }

    const db = await readDb();
    const cleanId = String(deviceId).trim().toUpperCase();
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
        fingerprintStatus: fingerprintStatus || 'SMF V1.7 Ready (UART 57600)',
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
