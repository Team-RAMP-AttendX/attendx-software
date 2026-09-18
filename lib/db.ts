import fs from 'fs/promises';
import path from 'path';
import { DatabaseSchema, User, Fingerprint, AttendanceRecord, PINImage, Device } from '../types';

const DB_FILE_PATH = path.join(process.cwd(), 'data', 'db.json');

// Default initial data for the demo
const INITIAL_DATA: DatabaseSchema = {
  users: [
    { id: 'USR001', name: 'John Doe', role: 'Student', status: 'Active', dateRegistered: new Date().toISOString(), totalAttendance: 45, lateOccurrences: 2 },
    { id: 'USR002', name: 'Amina Yusuf', role: 'Staff', status: 'Active', dateRegistered: new Date().toISOString(), totalAttendance: 120, lateOccurrences: 0 },
    { id: 'USR003', name: 'David Smith', role: 'Student', status: 'Active', dateRegistered: new Date().toISOString(), totalAttendance: 42, lateOccurrences: 5 }
  ],
  fingerprints: [
    { id: 'FP001', userId: 'USR001', registrationDate: new Date().toISOString(), status: 'Active' },
    { id: 'FP002', userId: 'USR002', registrationDate: new Date().toISOString(), status: 'Active' }
  ],
  attendance: [],
  images: [],
  devices: [
    { id: 'DEV_TERM_01', status: 'ONLINE', wifiStatus: 'Connected', lastSync: new Date().toISOString(), pendingRecords: 0, batteryStatus: 87, powerStatus: 'AC' }
  ]
};

// Ensure directory and file exists
async function initDb() {
  const dir = path.dirname(DB_FILE_PATH);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }

  try {
    await fs.access(DB_FILE_PATH);
  } catch {
    const now = new Date();
    
    // Generate mock historical attendance for the past 6 days
    for (let i = 6; i >= 1; i--) {
      const pastDate = new Date();
      pastDate.setDate(now.getDate() - i);
      const pastDateStr = pastDate.toISOString().split('T')[0];
      
      const johnTime = new Date(pastDate); johnTime.setHours(8, 40 + Math.floor(Math.random() * 15), 0);
      const aminaTime = new Date(pastDate); aminaTime.setHours(8, 45 + Math.floor(Math.random() * 10), 0);
      const davidTime = new Date(pastDate); davidTime.setHours(9, Math.floor(Math.random() * 25), 0);
      
      const attIdBase = `ATT_PAST_${i}`;
      if (Math.random() > 0.1) INITIAL_DATA.attendance.push({ id: `${attIdBase}_1`, userId: 'USR001', deviceId: 'DEV_TERM_01', date: pastDateStr, checkInTime: johnTime.toISOString(), checkInMode: 'fingerprint', status: 'Present', lateDurationMinutes: 0, syncStatus: 'Synced', createdAt: johnTime.toISOString() });
      if (Math.random() > 0.05) INITIAL_DATA.attendance.push({ id: `${attIdBase}_2`, userId: 'USR002', deviceId: 'DEV_TERM_01', date: pastDateStr, checkInTime: aminaTime.toISOString(), checkInMode: 'fingerprint', status: 'Present', lateDurationMinutes: 0, syncStatus: 'Synced', createdAt: aminaTime.toISOString() });
      if (Math.random() > 0.2) INITIAL_DATA.attendance.push({ id: `${attIdBase}_3`, userId: 'USR003', deviceId: 'DEV_TERM_01', date: pastDateStr, checkInTime: davidTime.toISOString(), checkInMode: 'pin', status: 'Late', lateDurationMinutes: davidTime.getMinutes(), syncStatus: 'Synced', createdAt: davidTime.toISOString() });
    }

    // Generate some mock attendance for today
    const today = new Date().toISOString().split('T')[0];
    
    // John Check-In on time
    const johnTime = new Date(now); johnTime.setHours(8, 42, 0);
    const aminaTime = new Date(now); aminaTime.setHours(8, 57, 0);
    const davidTime = new Date(now); davidTime.setHours(9, 17, 0);
    
    INITIAL_DATA.attendance.push(
      { id: 'ATT001', userId: 'USR001', deviceId: 'DEV_TERM_01', date: today, checkInTime: johnTime.toISOString(), checkInMode: 'fingerprint', status: 'Present', lateDurationMinutes: 0, syncStatus: 'Synced', createdAt: johnTime.toISOString() },
      { id: 'ATT002', userId: 'USR002', deviceId: 'DEV_TERM_01', date: today, checkInTime: aminaTime.toISOString(), checkInMode: 'fingerprint', status: 'Present', lateDurationMinutes: 0, syncStatus: 'Synced', createdAt: aminaTime.toISOString() },
      { id: 'ATT003', userId: 'USR003', deviceId: 'DEV_TERM_01', date: today, checkInTime: davidTime.toISOString(), checkInMode: 'pin', status: 'Late', lateDurationMinutes: 17, syncStatus: 'Synced', createdAt: davidTime.toISOString() }
    );
    
    INITIAL_DATA.images.push({
      id: 'IMG001', attendanceId: 'ATT003', userId: 'USR003', captureTime: davidTime.toISOString(), authMode: 'pin', storageRef: '/demo-evidence.jpg'
    });

    await fs.writeFile(DB_FILE_PATH, JSON.stringify(INITIAL_DATA, null, 2), 'utf-8');
  }
}

export async function readDb(): Promise<DatabaseSchema> {
  await initDb();
  const data = await fs.readFile(DB_FILE_PATH, 'utf-8');
  return JSON.parse(data);
}

export async function writeDb(data: DatabaseSchema): Promise<void> {
  await initDb();
  await fs.writeFile(DB_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}
