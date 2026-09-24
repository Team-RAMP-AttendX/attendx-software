/**
 * In-memory simulation engine for AttendX.
 * When System Simulation Mode is active, the app reads and operates exclusively
 * through this store—zero reads and zero writes to Cloud Firestore.
 */

import { User, Device, AttendanceRecord, PINImage } from '@/types';

export interface SimulationState {
  isSimulationMode: boolean;
  users: User[];
  devices: Device[];
  attendance: AttendanceRecord[];
  images: PINImage[];
  liveLogMessage: string | null;
}

const MOCK_USERS: User[] = [
  { id: 'USR001', name: 'John Doe', role: 'Student', status: 'Active', dateRegistered: '2026-09-01T08:00:00Z', totalAttendance: 45, lateOccurrences: 1 },
  { id: 'USR002', name: 'Amina Yusuf', role: 'Staff', status: 'Active', dateRegistered: '2026-08-15T08:00:00Z', totalAttendance: 118, lateOccurrences: 0 },
  { id: 'USR003', name: 'David Smith', role: 'Student', status: 'Active', dateRegistered: '2026-09-05T08:00:00Z', totalAttendance: 40, lateOccurrences: 4 },
  { id: 'USR004', name: 'Prof. Marcus Chen', role: 'Staff', status: 'Active', dateRegistered: '2026-08-01T08:00:00Z', totalAttendance: 140, lateOccurrences: 0 },
  { id: 'USR005', name: 'Zainab Bello', role: 'Student', status: 'Active', dateRegistered: '2026-09-10T08:00:00Z', totalAttendance: 38, lateOccurrences: 2 }
];

const MOCK_DEVICES: Device[] = [
  {
    id: 'DEV_TERM_01',
    name: 'Main Campus Terminal A',
    location: 'Engineering Hall East Entrance',
    status: 'ONLINE',
    wifiStatus: 'Connected',
    rssi: -54,
    lastSync: new Date().toISOString(),
    pendingRecords: 0,
    batteryStatus: 94,
    powerStatus: 'AC',
    ipAddress: '192.168.1.102',
    macAddress: '24:0A:C4:B8:3A:1E',
    firmwareVersion: 'AttendX-FW v2.4.1 (Simulated)',
    esp32Heap: '312 KB Free / 520 KB Total',
    fingerprintStatus: 'AS608 Optical Sensor Ready',
    cameraStatus: 'ESP32-CAM Active (SVGA OV2640)',
    keypadStatus: '4x4 Matrix Active',
    lcdStatus: '16x2 I2C LCD Ready (0x27)',
    lcdText: ['** ATTENDX [SIM] **', 'Ready for Scan...', 'System: SIMULATED', 'Net: HOTSPOT-DEMO'],
    voltage: '4.21V (Li-ion)',
    enrolledFingerprints: 4,
    maxSlots: 300,
    freeSlots: 296
  },
  {
    id: 'DEV_TERM_02',
    name: 'Library South Hub',
    location: 'Library Quad Floor 1',
    status: 'ONLINE',
    wifiStatus: 'Connected',
    rssi: -62,
    lastSync: new Date(Date.now() - 45000).toISOString(),
    pendingRecords: 0,
    batteryStatus: 88,
    powerStatus: 'Battery',
    ipAddress: '192.168.1.108',
    macAddress: '24:0A:C4:B8:77:2D',
    firmwareVersion: 'AttendX-FW v2.4.1 (Simulated)',
    esp32Heap: '284 KB Free / 520 KB Total',
    fingerprintStatus: 'AS608 Optical Sensor Ready',
    cameraStatus: 'ESP32-CAM Standby',
    keypadStatus: '4x4 Matrix Active',
    lcdStatus: '16x2 I2C LCD Ready',
    lcdText: ['** ATTENDX LIB **', 'Place Finger/PIN', 'Battery: 88%', 'Net: LIB-WIFI-5G'],
    voltage: '3.98V (Li-ion)',
    enrolledFingerprints: 2,
    maxSlots: 300,
    freeSlots: 298
  }
];

const generateMockAttendance = (): AttendanceRecord[] => {
  const records: AttendanceRecord[] = [];
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  const times = [
    { u: 'USR002', h: 8, m: 24, mode: 'fingerprint' as const, status: 'Present' as const, late: 0 },
    { u: 'USR004', h: 8, m: 35, mode: 'fingerprint' as const, status: 'Present' as const, late: 0 },
    { u: 'USR001', h: 8, m: 52, mode: 'fingerprint' as const, status: 'Present' as const, late: 0 },
    { u: 'USR005', h: 9, m: 8, mode: 'pin' as const, status: 'Late' as const, late: 8 },
    { u: 'USR003', h: 9, m: 19, mode: 'pin' as const, status: 'Late' as const, late: 19 }
  ];

  times.forEach((t, idx) => {
    const d = new Date(now);
    d.setHours(t.h, t.m, Math.floor(Math.random() * 50));
    records.push({
      id: `SIM_ATT_${idx + 1}`,
      userId: t.u,
      deviceId: idx % 2 === 0 ? 'DEV_TERM_01' : 'DEV_TERM_02',
      date: today,
      checkInTime: d.toISOString(),
      checkInMode: t.mode,
      status: t.status,
      lateDurationMinutes: t.late,
      syncStatus: 'Synced',
      createdAt: d.toISOString()
    });
  });

  return records;
};

const MOCK_IMAGES: PINImage[] = [
  {
    id: 'SIM_IMG_01',
    attendanceId: 'SIM_ATT_4',
    userId: 'USR005',
    captureTime: new Date(Date.now() - 3600000).toISOString(),
    authMode: 'pin',
    storageRef: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
  },
  {
    id: 'SIM_IMG_02',
    attendanceId: 'SIM_ATT_5',
    userId: 'USR003',
    captureTime: new Date(Date.now() - 1800000).toISOString(),
    authMode: 'pin',
    storageRef: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80'
  }
];

export function createInitialSimulationState(): SimulationState {
  return {
    isSimulationMode: false,
    users: MOCK_USERS,
    devices: MOCK_DEVICES,
    attendance: generateMockAttendance(),
    images: MOCK_IMAGES,
    liveLogMessage: null
  };
}
