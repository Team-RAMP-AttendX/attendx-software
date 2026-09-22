import {
  collection,
  doc,
  getDocs,
  setDoc,
  writeBatch
} from 'firebase/firestore';
import { firestore } from './firebase';
import { DatabaseSchema, User, Fingerprint, AttendanceRecord, PINImage, Device } from '../types';

// Default initial data to seed Firestore if empty
const INITIAL_DATA: DatabaseSchema = {
  users: [
    { id: 'USR001', name: 'John Doe', role: 'Student', status: 'Active', dateRegistered: new Date().toISOString(), totalAttendance: 45, lateOccurrences: 2 },
    { id: 'USR002', name: 'Amina Yusuf', role: 'Staff', status: 'Active', dateRegistered: new Date().toISOString(), totalAttendance: 120, lateOccurrences: 0 },
    { id: 'USR003', name: 'David Smith', role: 'Student', status: 'Active', dateRegistered: new Date().toISOString(), totalAttendance: 42, lateOccurrences: 5 }
  ],
  fingerprints: [
    { id: 'FP001', userId: 'USR001', registrationDate: new Date().toISOString(), status: 'Active', slotNumber: 1, templateData: 'SMF17_FP_USR001_SAMPLE_TEMPLATE_HEX_A5F90B2', enrolledTerminals: ['DEV_TERM_01'] },
    { id: 'FP002', userId: 'USR002', registrationDate: new Date().toISOString(), status: 'Active', slotNumber: 2, templateData: 'SMF17_FP_USR002_SAMPLE_TEMPLATE_HEX_C8E41A1', enrolledTerminals: ['DEV_TERM_01'] }
  ],
  attendance: [],
  images: [],
  devices: [
    {
      id: 'DEV_TERM_01',
      name: 'Main Campus Terminal A',
      location: 'Engineering Hall East Entrance',
      status: 'ONLINE',
      wifiStatus: 'Connected',
      rssi: -58,
      lastSync: new Date().toISOString(),
      pendingRecords: 0,
      batteryStatus: 92,
      powerStatus: 'AC',
      ipAddress: '192.168.1.102',
      macAddress: '24:0A:C4:B8:3A:1E',
      firmwareVersion: 'AttendX-FW v2.4.1',
      esp32Heap: '296 KB Free / 520 KB Total',
      fingerprintStatus: 'SMF V1.7 Ready (UART 57600)',
      cameraStatus: 'ESP-CAM Standby (SVGA OV2640)',
      keypadStatus: '4x4 Matrix Active',
      lcdStatus: '16x2 / 20x4 I2C LCD Ready (0x27)',
      lcdText: ['** ATTENDX TERMINAL **', 'Ready for Scan...', 'Time: 09:15 AM [SYNC]', 'Net: CONNECTED | Bat:92%'],
      voltage: '4.18V (Li-ion)',
      enrolledFingerprints: 2
    }
  ]
};

let isSeeded = false;

/**
 * Initializes Firestore with base records if collections are empty.
 */
async function ensureFirestoreInitialized() {
  if (isSeeded) return;

  try {
    const usersCol = collection(firestore, 'users');
    const userSnapshot = await getDocs(usersCol);

    if (userSnapshot.empty) {
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      const johnTime = new Date(now); johnTime.setHours(8, 42, 0);
      const aminaTime = new Date(now); aminaTime.setHours(8, 57, 0);
      const davidTime = new Date(now); davidTime.setHours(9, 17, 0);

      const initialAttendance: AttendanceRecord[] = [
        { id: 'ATT001', userId: 'USR001', deviceId: 'DEV_TERM_01', date: today, checkInTime: johnTime.toISOString(), checkInMode: 'fingerprint', status: 'Present', lateDurationMinutes: 0, syncStatus: 'Synced', createdAt: johnTime.toISOString() },
        { id: 'ATT002', userId: 'USR002', deviceId: 'DEV_TERM_01', date: today, checkInTime: aminaTime.toISOString(), checkInMode: 'fingerprint', status: 'Present', lateDurationMinutes: 0, syncStatus: 'Synced', createdAt: aminaTime.toISOString() },
        { id: 'ATT003', userId: 'USR003', deviceId: 'DEV_TERM_01', date: today, checkInTime: davidTime.toISOString(), checkInMode: 'pin', status: 'Late', lateDurationMinutes: 17, syncStatus: 'Synced', createdAt: davidTime.toISOString() }
      ];

      // Add past 6 days historical records
      for (let i = 6; i >= 1; i--) {
        const pastDate = new Date();
        pastDate.setDate(now.getDate() - i);
        const pastDateStr = pastDate.toISOString().split('T')[0];
        const jTime = new Date(pastDate); jTime.setHours(8, 40 + (i * 2) % 15, 0);
        const aTime = new Date(pastDate); aTime.setHours(8, 48 + (i * 3) % 10, 0);
        const dTime = new Date(pastDate); dTime.setHours(9, 5 + (i * 4) % 25, 0);

        initialAttendance.push(
          { id: `ATT_HIST_${i}_1`, userId: 'USR001', deviceId: 'DEV_TERM_01', date: pastDateStr, checkInTime: jTime.toISOString(), checkInMode: 'fingerprint', status: 'Present', lateDurationMinutes: 0, syncStatus: 'Synced', createdAt: jTime.toISOString() },
          { id: `ATT_HIST_${i}_2`, userId: 'USR002', deviceId: 'DEV_TERM_01', date: pastDateStr, checkInTime: aTime.toISOString(), checkInMode: 'fingerprint', status: 'Present', lateDurationMinutes: 0, syncStatus: 'Synced', createdAt: aTime.toISOString() },
          { id: `ATT_HIST_${i}_3`, userId: 'USR003', deviceId: 'DEV_TERM_01', date: pastDateStr, checkInTime: dTime.toISOString(), checkInMode: 'pin', status: 'Late', lateDurationMinutes: dTime.getMinutes(), syncStatus: 'Synced', createdAt: dTime.toISOString() }
        );
      }

      const initialImages: PINImage[] = [
        {
          id: 'IMG001',
          attendanceId: 'ATT003',
          userId: 'USR003',
          captureTime: davidTime.toISOString(),
          authMode: 'pin',
          storageRef: '/demo-evidence.jpg'
        }
      ];

      const batch = writeBatch(firestore);

      for (const u of INITIAL_DATA.users) {
        batch.set(doc(firestore, 'users', u.id), u);
      }
      for (const fp of INITIAL_DATA.fingerprints) {
        batch.set(doc(firestore, 'fingerprints', fp.id), fp);
      }
      for (const dev of INITIAL_DATA.devices) {
        batch.set(doc(firestore, 'devices', dev.id), dev);
      }
      for (const att of initialAttendance) {
        batch.set(doc(firestore, 'attendance', att.id), att);
      }
      for (const img of initialImages) {
        batch.set(doc(firestore, 'images', img.id), img);
      }

      await batch.commit();
    }
    isSeeded = true;
  } catch (error) {
    console.error('Firestore init error:', error);
  }
}

/**
 * Reads the entire database state from Cloud Firestore.
 */
export async function readDb(): Promise<DatabaseSchema> {
  await ensureFirestoreInitialized();

  const [usersSnap, fpsSnap, attSnap, devsSnap, imgsSnap] = await Promise.all([
    getDocs(collection(firestore, 'users')),
    getDocs(collection(firestore, 'fingerprints')),
    getDocs(collection(firestore, 'attendance')),
    getDocs(collection(firestore, 'devices')),
    getDocs(collection(firestore, 'images'))
  ]);

  const users = usersSnap.docs.map(d => ({ ...d.data(), id: d.id })) as User[];
  const fingerprints = fpsSnap.docs.map(d => ({ ...d.data(), id: d.id })) as Fingerprint[];
  const attendance = attSnap.docs.map(d => ({ ...d.data(), id: d.id })) as AttendanceRecord[];
  const devices = devsSnap.docs.map(d => ({ ...d.data(), id: d.id })) as Device[];
  const images = imgsSnap.docs.map(d => ({ ...d.data(), id: d.id })) as PINImage[];

  return {
    users,
    fingerprints,
    attendance,
    devices,
    images
  };
}

/**
 * Saves/updates entire database state to Cloud Firestore in atomic batches.
 */
export async function writeDb(data: DatabaseSchema): Promise<void> {
  await ensureFirestoreInitialized();

  // Commit writes in chunks to respect Firestore 500 operations per batch
  const allOperations: Array<{ collection: string; id: string; data: Record<string, unknown> }> = [];

  for (const u of data.users) allOperations.push({ collection: 'users', id: u.id, data: u as unknown as Record<string, unknown> });
  for (const fp of data.fingerprints) allOperations.push({ collection: 'fingerprints', id: fp.id, data: fp as unknown as Record<string, unknown> });
  for (const dev of data.devices) allOperations.push({ collection: 'devices', id: dev.id, data: dev as unknown as Record<string, unknown> });
  for (const att of data.attendance) allOperations.push({ collection: 'attendance', id: att.id, data: att as unknown as Record<string, unknown> });
  for (const img of data.images) allOperations.push({ collection: 'images', id: img.id, data: img as unknown as Record<string, unknown> });

  const BATCH_SIZE = 400;
  for (let i = 0; i < allOperations.length; i += BATCH_SIZE) {
    const batch = writeBatch(firestore);
    const chunk = allOperations.slice(i, i + BATCH_SIZE);
    for (const op of chunk) {
      batch.set(doc(firestore, op.collection, op.id), op.data, { merge: true });
    }
    await batch.commit();
  }
}

/**
 * Upserts a single user document to Firestore.
 */
export async function saveUserDoc(user: User): Promise<void> {
  await setDoc(doc(firestore, 'users', user.id), user, { merge: true });
}

/**
 * Upserts a single device document to Firestore.
 */
export async function saveDeviceDoc(device: Device): Promise<void> {
  await setDoc(doc(firestore, 'devices', device.id), device, { merge: true });
}

/**
 * Upserts a single attendance record to Firestore.
 */
export async function saveAttendanceDoc(record: AttendanceRecord): Promise<void> {
  await setDoc(doc(firestore, 'attendance', record.id), record, { merge: true });
}

/**
 * Upserts a single fingerprint document to Firestore.
 */
export async function saveFingerprintDoc(fp: Fingerprint): Promise<void> {
  await setDoc(doc(firestore, 'fingerprints', fp.id), fp, { merge: true });
}

/**
 * Upserts a single camera evidence image document to Firestore.
 */
export async function saveImageDoc(image: PINImage): Promise<void> {
  await setDoc(doc(firestore, 'images', image.id), image, { merge: true });
}
