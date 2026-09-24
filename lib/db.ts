import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  writeBatch
} from 'firebase/firestore';
import { firestore } from './firebase';
import { DatabaseSchema, User, Fingerprint, AttendanceRecord, PINImage, Device, Administrator, TerminalCommand, CommandResultReport } from '../types';

export const MASTER_ADMIN_EMAIL = 'redemptionjonathan1@gmail.com';

export const DEFAULT_MASTER_ADMIN: Administrator = {
  id: 'admin_master',
  email: 'redemptionjonathan1@gmail.com',
  name: 'Jonathan Redemption',
  role: 'Master Administrator',
  status: 'Active',
  isMaster: true,
  addedAt: '2026-09-01T00:00:00.000Z',
  addedBy: 'Root Provisioning',
  notes: 'Primary Master Administrator with root authority to provision additional system administrators.'
};

// Default initial data to seed Firestore if empty
const INITIAL_DATA: DatabaseSchema = {
  users: [
    { id: 'USR001', name: 'John Doe', role: 'Student', status: 'Active', dateRegistered: new Date().toISOString(), totalAttendance: 45, lateOccurrences: 2 },
    { id: 'USR002', name: 'Amina Yusuf', role: 'Staff', status: 'Active', dateRegistered: new Date().toISOString(), totalAttendance: 120, lateOccurrences: 0 },
    { id: 'USR003', name: 'David Smith', role: 'Student', status: 'Active', dateRegistered: new Date().toISOString(), totalAttendance: 42, lateOccurrences: 5 }
  ],
  fingerprints: [
    { id: 'FP001', userId: 'USR001', registrationDate: new Date().toISOString(), status: 'Active', slotNumber: 1, templateData: 'DY50_FP_USR001_SAMPLE_TEMPLATE_HEX_A5F90B2', enrolledTerminals: ['DEV_TERM_01'] },
    { id: 'FP002', userId: 'USR002', registrationDate: new Date().toISOString(), status: 'Active', slotNumber: 2, templateData: 'DY50_FP_USR002_SAMPLE_TEMPLATE_HEX_C8E41A1', enrolledTerminals: ['DEV_TERM_01'] }
  ],
  attendance: [],
  images: [],
  devices: [
    {
      id: 'DEV_TERM_01',
      name: 'Main Campus Terminal A',
      location: 'Engineering Hall East Entrance',
      status: 'OFFLINE',
      wifiStatus: 'Disconnected',
      rssi: 0,
      lastSync: new Date(Date.now() - 3600000).toISOString(),
      pendingRecords: 0,
      batteryStatus: 85,
      powerStatus: 'AC',
      ipAddress: '192.168.1.102',
      macAddress: '24:0A:C4:B8:3A:1E',
      firmwareVersion: 'AttendX-FW v2.4.1',
      esp32Heap: '296 KB Free / 520 KB Total',
      fingerprintStatus: 'DY50 Ready (UART 57600)',
      cameraStatus: 'ESP-CAM Standby (SVGA OV2640)',
      keypadStatus: '4x4 Matrix Active',
      lcdStatus: '16x2 / 20x4 I2C LCD Ready (0x27)',
      lcdText: ['** ATTENDX TERMINAL **', 'Awaiting Hardware...', 'Hardware Inactive', 'Net: DISCONNECTED'],
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
  try {
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
      users: users.length > 0 ? users : INITIAL_DATA.users,
      fingerprints: fingerprints.length > 0 ? fingerprints : INITIAL_DATA.fingerprints,
      attendance,
      devices: devices.length > 0 ? devices : INITIAL_DATA.devices,
      images
    };
  } catch (err) {
    console.error('Firestore read error, returning fallback initial data:', err);
    return INITIAL_DATA;
  }
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
 * Permanently deletes a user document and associated fingerprints from Firestore.
 */
export async function deleteUserDoc(userId: string): Promise<void> {
  try {
    await deleteDoc(doc(firestore, 'users', userId));
    const fpSnap = await getDocs(collection(firestore, 'fingerprints'));
    const userFpDocs = fpSnap.docs.filter(d => d.data().userId === userId);
    for (const d of userFpDocs) {
      await deleteDoc(doc(firestore, 'fingerprints', d.id));
    }
  } catch (err) {
    console.error(`Failed to delete user doc ${userId}:`, err);
    throw err;
  }
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

/**
 * Resets all sidebar page values across the persistent Firestore database.
 * Clears attendance logs, evidence photos, resets user attendance tallies to 0,
 * and sets terminal pending queues to 0.
 */
export async function resetDatabaseToCleanState(): Promise<void> {
  try {
    const [attSnap, imgsSnap, usersSnap, devsSnap] = await Promise.all([
      getDocs(collection(firestore, 'attendance')),
      getDocs(collection(firestore, 'images')),
      getDocs(collection(firestore, 'users')),
      getDocs(collection(firestore, 'devices'))
    ]);

    // 1. Delete all attendance records
    for (const d of attSnap.docs) {
      await deleteDoc(doc(firestore, 'attendance', d.id));
    }

    // 2. Delete all image evidence
    for (const d of imgsSnap.docs) {
      await deleteDoc(doc(firestore, 'images', d.id));
    }

    // 3. Reset user attendance and late stats to 0
    const userBatch = writeBatch(firestore);
    for (const d of usersSnap.docs) {
      const u = d.data();
      userBatch.update(doc(firestore, 'users', d.id), {
        totalAttendance: 0,
        lateOccurrences: 0
      });
    }
    await userBatch.commit();

    // 4. Reset device pending records & logs
    const devBatch = writeBatch(firestore);
    for (const d of devsSnap.docs) {
      devBatch.update(doc(firestore, 'devices', d.id), {
        pendingRecords: 0,
        lastSync: new Date().toISOString(),
        lcdText: ['** ATTENDX TERMINAL **', 'Ready for Scan...', 'System: ZEROED [CLEAN]', 'Net: CONNECTED']
      });
    }
    await devBatch.commit();
  } catch (err) {
    console.error('Error resetting database to clean state:', err);
    throw err;
  }
}

/**
 * Retrieves all registered administrators from Firestore.
 * Automatically provisions the master administrator if not present.
 */
export async function getAdministrators(): Promise<Administrator[]> {
  try {
    const colRef = collection(firestore, 'administrators');
    const snapshot = await getDocs(colRef);
    if (snapshot.empty) {
      await setDoc(doc(firestore, 'administrators', DEFAULT_MASTER_ADMIN.id), DEFAULT_MASTER_ADMIN);
      return [DEFAULT_MASTER_ADMIN];
    }
    const admins: Administrator[] = [];
    snapshot.forEach(docSnap => {
      admins.push(docSnap.data() as Administrator);
    });
    // Ensure master admin is always present
    const hasMaster = admins.some(a => a.email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase());
    if (!hasMaster) {
      await setDoc(doc(firestore, 'administrators', DEFAULT_MASTER_ADMIN.id), DEFAULT_MASTER_ADMIN);
      admins.unshift(DEFAULT_MASTER_ADMIN);
    }
    return admins;
  } catch (err) {
    console.error('Error fetching administrators from Firestore:', err);
    return [DEFAULT_MASTER_ADMIN];
  }
}

/**
 * Saves or updates an administrator document in Firestore.
 */
export async function saveAdministratorDoc(admin: Administrator): Promise<void> {
  await setDoc(doc(firestore, 'administrators', admin.id), admin, { merge: true });
}

/**
 * Deletes an administrator document from Firestore.
 * Master administrator cannot be deleted.
 */
export async function deleteAdministratorDoc(id: string): Promise<void> {
  if (id === DEFAULT_MASTER_ADMIN.id) {
    throw new Error('The Master Administrator account cannot be deleted.');
  }
  await deleteDoc(doc(firestore, 'administrators', id));
}

export async function getPendingCommandsForDevice(deviceId: string): Promise<TerminalCommand[]> {
  try {
    const cleanId = deviceId.trim().toUpperCase();
    const colRef = collection(firestore, 'commands');
    const snapshot = await getDocs(colRef);
    const cmds: TerminalCommand[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as TerminalCommand;
      if (data.deviceId === cleanId && (data.status === 'PENDING' || data.status === 'DISPATCHED')) {
        cmds.push({ ...data, commandId: docSnap.id });
      }
    });
    return cmds;
  } catch (err) {
    console.error('Error fetching pending commands:', err);
    return [];
  }
}

export async function queueCommandForDevice(cmd: Omit<TerminalCommand, 'createdAt' | 'status'>): Promise<TerminalCommand> {
  const fullCmd: TerminalCommand = {
    ...cmd,
    deviceId: cmd.deviceId.trim().toUpperCase(),
    status: 'PENDING',
    createdAt: new Date().toISOString()
  };
  await setDoc(doc(firestore, 'commands', fullCmd.commandId), fullCmd);
  return fullCmd;
}

export async function recordCommandResult(report: CommandResultReport): Promise<void> {
  const cleanDeviceId = report.deviceId.trim().toUpperCase();
  const now = new Date().toISOString();

  // If commandId provided, update the command record
  if (report.commandId) {
    const cmdRef = doc(firestore, 'commands', report.commandId);
    await setDoc(cmdRef, {
      status: report.status === 'success' ? 'COMPLETED' : 'FAILED',
      completedAt: now,
      slotNumber: report.slotNumber,
      errorReason: report.errorReason
    }, { merge: true });
  }

  // Update biometric template mapping in database
  if (report.status === 'success') {
    if (report.type === 'ENROLL_FINGERPRINT' && report.userId && report.slotNumber !== undefined) {
      const db = await readDb();
      const existingFp = db.fingerprints.find(f => f.userId === report.userId);
      if (existingFp) {
        existingFp.status = 'Active';
        existingFp.slotNumber = report.slotNumber;
        if (!existingFp.enrolledTerminals) existingFp.enrolledTerminals = [];
        if (!existingFp.enrolledTerminals.includes(cleanDeviceId)) {
          existingFp.enrolledTerminals.push(cleanDeviceId);
        }
      } else {
        db.fingerprints.push({
          id: `FP_${Date.now()}`,
          userId: report.userId,
          registrationDate: now,
          status: 'Active',
          slotNumber: report.slotNumber,
          templateData: `DY50_FP_${report.userId}_SLOT_${report.slotNumber}`,
          enrolledTerminals: [cleanDeviceId]
        });
      }
      await writeDb(db);
    } else if (report.type === 'DELETE_FINGERPRINT' && report.slotNumber !== undefined) {
      const db = await readDb();
      const fp = db.fingerprints.find(f => f.slotNumber === report.slotNumber && f.enrolledTerminals?.includes(cleanDeviceId));
      if (fp) {
        fp.enrolledTerminals = fp.enrolledTerminals?.filter(t => t !== cleanDeviceId) || [];
        if (fp.enrolledTerminals.length === 0) {
          fp.status = 'Inactive';
        }
      }
      await writeDb(db);
    }
  }
}

/**
 * Verifies if an email address belongs to an authorized active administrator.
 */
export async function isAuthorizedAdminEmail(email: string): Promise<{ authorized: boolean; admin?: Administrator }> {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return { authorized: false };

  // Master admin is unconditionally authorized
  if (normalized === MASTER_ADMIN_EMAIL.toLowerCase()) {
    return { authorized: true, admin: DEFAULT_MASTER_ADMIN };
  }

  try {
    const admins = await getAdministrators();
    const found = admins.find(a => a.email.toLowerCase() === normalized);
    if (found && found.status === 'Active') {
      return { authorized: true, admin: found };
    }
    return { authorized: false, admin: found };
  } catch (err) {
    console.error('Error checking authorized admin email:', err);
    // Fallback: master admin is safe
    return { authorized: normalized === MASTER_ADMIN_EMAIL.toLowerCase() };
  }
}
