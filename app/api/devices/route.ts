import { NextResponse } from 'next/server';
import { readDb, writeDb } from '@/lib/db';
import { Device } from '@/types';

export async function GET() {
  try {
    const db = await readDb();

    // Enrich devices with default hardware subsystems if missing
    const enrichedDevices: Device[] = db.devices.map((device, index) => ({
      ...device,
      name: device.name || (index === 0 ? 'Main Entrance Terminal' : `Terminal Unit ${index + 1}`),
      location: device.location || (index === 0 ? 'Administration Building, Gate 1' : `Wing ${String.fromCharCode(65 + index)} Hallway`),
      ipAddress: device.ipAddress || `192.168.1.${101 + index}`,
      macAddress: device.macAddress || `24:0A:C4:B8:3A:${(10 + index).toString(16).toUpperCase()}`,
      firmwareVersion: device.firmwareVersion || 'AttendX-FW v2.4.1',
      esp32Heap: device.esp32Heap || '284 KB Free / 520 KB Total',
      fingerprintStatus: device.fingerprintStatus || 'SMF V1.7 Ready (UART 57600)',
      cameraStatus: device.cameraStatus || 'ESP-CAM Standby (SVGA OV2640)',
      keypadStatus: device.keypadStatus || '4x4 Matrix Active (50ms debounce)',
      lcdStatus: device.lcdStatus || '20x4 I2C LCD Ready (0x27)',
      lcdText: device.lcdText || [
        '** ATTENDX TERMINAL **',
        'Ready for Scan...',
        'Time: 08:57 AM [SYNC]',
        `Net: ${device.wifiStatus.toUpperCase()} | Bat:${device.batteryStatus}%`
      ],
      voltage: device.voltage || '4.15V (Nominal 3.7V Li-ion)'
    }));

    return NextResponse.json(enrichedDevices);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch devices' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const db = await readDb();

    if (!body.id) {
      return NextResponse.json({ error: 'Device ID is required' }, { status: 400 });
    }

    const cleanId = body.id.trim().toUpperCase();
    if (db.devices.some(d => d.id === cleanId)) {
      return NextResponse.json({ error: 'A terminal with this Device ID already exists' }, { status: 409 });
    }

    const newDevice: Device = {
      id: cleanId,
      name: body.name?.trim() || `AttendX Terminal ${db.devices.length + 1}`,
      location: body.location?.trim() || 'Unassigned Facility Location',
      status: 'ONLINE',
      wifiStatus: body.wifiStatus === 'Disconnected' ? 'Disconnected' : 'Connected',
      lastSync: new Date().toISOString(),
      pendingRecords: 0,
      batteryStatus: body.batteryStatus ? Number(body.batteryStatus) : 95,
      powerStatus: body.powerStatus === 'Battery' ? 'Battery' : 'AC',
      ipAddress: body.ipAddress || `192.168.1.${110 + db.devices.length}`,
      macAddress: body.macAddress || `24:0A:C4:D5:19:${(20 + db.devices.length).toString(16).toUpperCase()}`,
      firmwareVersion: 'AttendX-FW v2.4.1',
      esp32Heap: '292 KB Free / 520 KB Total',
      fingerprintStatus: 'SMF V1.7 Ready (UART 57600)',
      cameraStatus: 'ESP-CAM Standby (SVGA OV2640)',
      keypadStatus: '4x4 Matrix Active (50ms debounce)',
      lcdStatus: '20x4 I2C LCD Ready (0x27)',
      lcdText: [
        '** ATTENDX TERMINAL **',
        'Ready for Scan...',
        'System Initialized',
        'Net: CONNECTED | Bat:95%'
      ],
      voltage: '4.18V (Nominal 3.7V Li-ion)'
    };

    db.devices.push(newDevice);
    await writeDb(db);

    return NextResponse.json(newDevice, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to add device' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const db = await readDb();

    if (!body.id) {
      return NextResponse.json({ error: 'Device ID is required' }, { status: 400 });
    }

    const deviceIndex = db.devices.findIndex(d => d.id === body.id);
    if (deviceIndex === -1) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    // Actions
    if (body.action === 'toggle_wifi') {
      const currentWifi = db.devices[deviceIndex].wifiStatus;
      const nextWifi = currentWifi === 'Connected' ? 'Disconnected' : 'Connected';
      db.devices[deviceIndex].wifiStatus = nextWifi;
      db.devices[deviceIndex].status = nextWifi === 'Connected' ? 'ONLINE' : 'OFFLINE';
      
      // If reconnecting, flush pending records
      if (nextWifi === 'Connected') {
        db.devices[deviceIndex].pendingRecords = 0;
        db.devices[deviceIndex].lastSync = new Date().toISOString();
      } else {
        // Simulating offline storage queue
        db.devices[deviceIndex].pendingRecords = (db.devices[deviceIndex].pendingRecords || 0) + 3;
      }
    } else if (body.action === 'sync') {
      db.devices[deviceIndex].pendingRecords = 0;
      db.devices[deviceIndex].lastSync = new Date().toISOString();
      db.devices[deviceIndex].status = 'ONLINE';
      db.devices[deviceIndex].wifiStatus = 'Connected';
    } else if (body.action === 'reboot') {
      db.devices[deviceIndex].lastSync = new Date().toISOString();
      db.devices[deviceIndex].status = 'ONLINE';
      db.devices[deviceIndex].wifiStatus = 'Connected';
      db.devices[deviceIndex].pendingRecords = 0;
    } else {
      // General field updates
      db.devices[deviceIndex] = {
        ...db.devices[deviceIndex],
        ...body
      };
    }

    await writeDb(db);
    return NextResponse.json(db.devices[deviceIndex]);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update device' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get('id');
    
    let deviceId = idParam;
    if (!deviceId) {
      try {
        const body = await req.json();
        deviceId = body.id;
      } catch {
        // no body
      }
    }

    if (!deviceId) {
      return NextResponse.json({ error: 'Device ID is required' }, { status: 400 });
    }

    const db = await readDb();
    const initialCount = db.devices.length;
    db.devices = db.devices.filter(d => d.id !== deviceId);

    if (db.devices.length === initialCount) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    await writeDb(db);
    return NextResponse.json({ success: true, message: `Device ${deviceId} removed` });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete device' }, { status: 500 });
  }
}
