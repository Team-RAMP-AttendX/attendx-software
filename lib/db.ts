import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch
} from 'firebase/firestore';
import { firestore } from './firebase';
import { DatabaseSchema, User, Fingerprint, AttendanceRecord, PINImage, Device, Administrator, TerminalCommand, CommandResultReport } from '../types';

export const MASTER_ADMIN_EMAIL = process.env.NEXT_PUBLIC_MASTER_ADMIN_EMAIL || 'redemptionjonathan1@gmail.com';

export const DEFAULT_MASTER_ADMIN: Administrator = {
  id: 'admin_master',
  email: MASTER_ADMIN_EMAIL,
  name: 'System Administrator',
  role: 'Master Administrator',
  status: 'Active',
  isMaster: true,
  addedAt: '2026-09-01T00:00:00.000Z',
  addedBy: 'Root Provisioning',
  notes: 'Primary Master Administrator with root authority to provision additional system administrators.'
};

/**
 * Validates whether a User ID conforms to the 4x4 keypad matrix format:
 * starts with numeric digits (0-9) and ends with a single letter (A-D or A-Z).
 * Examples: '001A', '002B', '101A', '123A', '1A'
 */
export function isValidKeypadUserId(id: string): boolean {
  return /^[0-9]+[A-Za-z]$/.test(id.trim());
}

/**
 * Generates the next sequential Keypad User ID based on existing IDs and the user's role.
 * Role default letters:
 * - Student -> 'A' (e.g. 001A)
 * - Staff   -> 'B' (e.g. 002B)
 * - Admin   -> 'C' (e.g. 003C)
 */
export function generateNextKeypadUserId(
  existingUsers: Array<{ id: string }>,
  role: 'Student' | 'Staff' | 'Admin' = 'Student'
): string {
  let maxNum = 0;
  for (const u of existingUsers) {
    const match = u.id.match(/^0*(\d+)[A-Za-z]?$/i) || u.id.match(/(\d+)/);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }
  const nextNum = maxNum + 1;
  const suffix = role === 'Staff' ? 'B' : role === 'Admin' ? 'C' : 'A';
  return `${String(nextNum).padStart(3, '0')}${suffix}`;
}

// Default initial data to seed Firestore ONLY ONCE with Keypad compatible IDs (digits 0-9 + single letter)
const INITIAL_DATA: DatabaseSchema = {
  users: [
    { id: '001A', name: 'John Doe', role: 'Student', status: 'Active', dateRegistered: new Date().toISOString(), totalAttendance: 45, lateOccurrences: 2 },
    { id: '002B', name: 'Amina Yusuf', role: 'Staff', status: 'Active', dateRegistered: new Date().toISOString(), totalAttendance: 120, lateOccurrences: 0 },
    { id: '003A', name: 'David Smith', role: 'Student', status: 'Active', dateRegistered: new Date().toISOString(), totalAttendance: 42, lateOccurrences: 5 }
  ],
  fingerprints: [
    { id: 'FP001', userId: '001A', registrationDate: new Date().toISOString(), status: 'Active', slotNumber: 1, templateData: 'DY50_FP_001A_SAMPLE_TEMPLATE_HEX_A5F90B2', enrolledTerminals: ['DEV_TERM_01'] },
    { id: 'FP002', userId: '002B', registrationDate: new Date().toISOString(), status: 'Active', slotNumber: 2, templateData: 'DY50_FP_002B_SAMPLE_TEMPLATE_HEX_C8E41A1', enrolledTerminals: ['DEV_TERM_01'] }
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
      rssi: -55,
      lastSync: new Date().toISOString(),
      pendingRecords: 0,
      batteryStatus: 85,
      powerStatus: 'AC',
      ipAddress: '192.168.1.102',
      macAddress: '24:0A:C4:B8:3A:1E',
      firmwareVersion: 'AttendX-FW v2.4.1',
      esp32Heap: '296 KB Free / 520 KB Total',
      fingerprintStatus: 'DY50 Ready (UART 57600)',
      cameraStatus: 'ESP32-S3-CAM Standby (SVGA OV2640)',
      keypadStatus: '4x4 Matrix Active',
      lcdStatus: '20x4 / 20x4 I2C LCD Ready (0x27)',
      lcdText: ['** ATTENDX TERMINAL **', 'Ready for Scan...', 'System: ONLINE', 'Net: CONNECTED'],
      voltage: '4.18V (Li-ion)',
      enrolledFingerprints: 2
    }
  ]
};

let isSeeded = false;

/**
 * Initializes Firestore with base records ONLY ONCE when system is first deployed.
 * Uses persistent `system/metadata` to prevent re-seeding after user deletions.
 */
async function ensureFirestoreInitialized() {
  if (isSeeded) return;

  try {
    // Check persistent metadata document first
    const metaDoc = await getDoc(doc(firestore, 'system', 'metadata'));
    if (metaDoc.exists() && metaDoc.data()?.initialized) {
      isSeeded = true;
      return;
    }

    // Check if any collections already contain documents
    const [usersSnap, devsSnap] = await Promise.all([
      getDocs(collection(firestore, 'users')),
      getDocs(collection(firestore, 'devices'))
    ]);

    if (!usersSnap.empty || !devsSnap.empty) {
      // Database already has records, mark persistent metadata as initialized
      await setDoc(doc(firestore, 'system', 'metadata'), {
        initialized: true,
        version: '2.4.1',
        updatedAt: new Date().toISOString()
      }, { merge: true });
      isSeeded = true;
      return;
    }

    // Fresh database: seed initial records and mark metadata
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const johnTime = new Date(now); johnTime.setHours(8, 42, 0);
    const aminaTime = new Date(now); aminaTime.setHours(8, 57, 0);
    const davidTime = new Date(now); davidTime.setHours(9, 17, 0);

    const initialAttendance: AttendanceRecord[] = [
      { id: 'ATT001', userId: '001A', deviceId: 'DEV_TERM_01', date: today, checkInTime: johnTime.toISOString(), checkInMode: 'fingerprint', status: 'Present', lateDurationMinutes: 0, syncStatus: 'Synced', createdAt: johnTime.toISOString() },
      { id: 'ATT002', userId: '002B', deviceId: 'DEV_TERM_01', date: today, checkInTime: aminaTime.toISOString(), checkInMode: 'fingerprint', status: 'Present', lateDurationMinutes: 0, syncStatus: 'Synced', createdAt: aminaTime.toISOString() },
      { id: 'ATT003', userId: '003A', deviceId: 'DEV_TERM_01', date: today, checkInTime: davidTime.toISOString(), checkInMode: 'pin', status: 'Late', lateDurationMinutes: 17, syncStatus: 'Synced', createdAt: davidTime.toISOString() }
    ];

    const batch = writeBatch(firestore);

    for (const u of INITIAL_DATA.users) {
      batch.set(doc(firestore, 'users', u.id), sanitizeForFirestore(u));
    }
    for (const fp of INITIAL_DATA.fingerprints) {
      batch.set(doc(firestore, 'fingerprints', fp.id), sanitizeForFirestore(fp));
    }
    for (const dev of INITIAL_DATA.devices) {
      batch.set(doc(firestore, 'devices', dev.id), sanitizeForFirestore(dev));
    }
    for (const att of initialAttendance) {
      batch.set(doc(firestore, 'attendance', att.id), sanitizeForFirestore(att));
    }
    batch.set(doc(firestore, 'system', 'metadata'), {
      initialized: true,
      version: '2.4.1',
      seededAt: new Date().toISOString()
    });

    await batch.commit();
    isSeeded = true;
  } catch (error) {
    console.error('Firestore init error:', error);
    isSeeded = true;
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
      users,
      fingerprints,
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
 * Strips all undefined fields recursively so Firestore batch.set / setDoc never throws.
 */
export function sanitizeForFirestore<T>(obj: T): any {
  if (!obj || typeof obj !== 'object') return obj;
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Saves/updates entire database state to Cloud Firestore in atomic batches.
 */
export async function writeDb(data: DatabaseSchema): Promise<void> {
  await ensureFirestoreInitialized();

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
      batch.set(doc(firestore, op.collection, op.id), sanitizeForFirestore(op.data), { merge: true });
    }
    await batch.commit();
  }
}

/**
 * Upserts a single user document to Firestore.
 */
export async function saveUserDoc(user: User): Promise<void> {
  await setDoc(doc(firestore, 'users', user.id), sanitizeForFirestore(user), { merge: true });
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
  await setDoc(doc(firestore, 'devices', device.id), sanitizeForFirestore(device), { merge: true });
}

/**
 * Permanently deletes a device document and associated commands/allocations from Firestore.
 */
export async function deleteDeviceDoc(deviceId: string): Promise<void> {
  const cleanId = String(deviceId).trim().toUpperCase();
  try {
    await deleteDoc(doc(firestore, 'devices', cleanId));
    if (cleanId !== deviceId) {
      await deleteDoc(doc(firestore, 'devices', deviceId));
    }

    const cmdCol = collection(firestore, 'commands');
    const cmdSnap = await getDocs(cmdCol);
    for (const d of cmdSnap.docs) {
      const data = d.data();
      if (data.deviceId === cleanId || data.deviceId === deviceId) {
        await deleteDoc(doc(firestore, 'commands', d.id));
      }
    }

    const fpCol = collection(firestore, 'fingerprints');
    const fpSnap = await getDocs(fpCol);
    for (const d of fpSnap.docs) {
      const data = d.data() as Fingerprint;
      if (data.enrolledTerminals && (data.enrolledTerminals.includes(cleanId) || data.enrolledTerminals.includes(deviceId))) {
        const updatedTerminals = data.enrolledTerminals.filter(t => t !== cleanId && t !== deviceId);
        await setDoc(doc(firestore, 'fingerprints', d.id), sanitizeForFirestore({
          ...data,
          enrolledTerminals: updatedTerminals
        }), { merge: true });
      }
    }
  } catch (err) {
    console.error(`Failed to delete device doc ${cleanId}:`, err);
    throw err;
  }
}

/**
 * Upserts a single attendance record to Firestore.
 */
export async function saveAttendanceDoc(record: AttendanceRecord): Promise<void> {
  await setDoc(doc(firestore, 'attendance', record.id), sanitizeForFirestore(record), { merge: true });
}

/**
 * Upserts a single fingerprint document to Firestore.
 */
export async function saveFingerprintDoc(fp: Fingerprint): Promise<void> {
  await setDoc(doc(firestore, 'fingerprints', fp.id), sanitizeForFirestore(fp), { merge: true });
}

/**
 * Upserts a single camera evidence image document to Firestore.
 */
export async function saveImageDoc(image: PINImage): Promise<void> {
  await setDoc(doc(firestore, 'images', image.id), sanitizeForFirestore(image), { merge: true });
}

/**
 * Resets all sidebar page values across the persistent Firestore database.
 */
export async function resetDatabaseToCleanState(): Promise<void> {
  try {
    const [attSnap, imgsSnap, usersSnap, devsSnap] = await Promise.all([
      getDocs(collection(firestore, 'attendance')),
      getDocs(collection(firestore, 'images')),
      getDocs(collection(firestore, 'users')),
      getDocs(collection(firestore, 'devices'))
    ]);

    for (const d of attSnap.docs) {
      await deleteDoc(doc(firestore, 'attendance', d.id));
    }
    for (const d of imgsSnap.docs) {
      await deleteDoc(doc(firestore, 'images', d.id));
    }

    const userBatch = writeBatch(firestore);
    for (const d of usersSnap.docs) {
      userBatch.update(doc(firestore, 'users', d.id), {
        totalAttendance: 0,
        lateOccurrences: 0
      });
    }
    await userBatch.commit();

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
 * Retrieves a single command by ID from Firestore.
 */
export async function getCommandById(commandId: string): Promise<TerminalCommand | null> {
  try {
    const cleanId = commandId.trim();
    const cmdSnap = await getDocs(collection(firestore, 'commands'));
    const docFound = cmdSnap.docs.find(d => d.id === cleanId || d.data().commandId === cleanId);
    if (docFound) {
      return { ...(docFound.data() as TerminalCommand), commandId: docFound.id };
    }
    return null;
  } catch (err) {
    console.error(`Error fetching command ${commandId}:`, err);
    return null;
  }
}

/**
 * Retrieves and locks pending commands for an ESP32 hardware device from Firestore.
 * Transitions status from PENDING to DISPATCHED so telemetry delivers it cleanly.
 */
export async function getPendingCommandsForDevice(deviceId: string): Promise<TerminalCommand[]> {
  try {
    const cleanId = deviceId.trim().toUpperCase();
    const colRef = collection(firestore, 'commands');
    const snapshot = await getDocs(colRef);
    const pendingCmds: TerminalCommand[] = [];

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as TerminalCommand;
      if (data.deviceId === cleanId && data.status === 'PENDING') {
        const full = { ...data, commandId: docSnap.id };
        pendingCmds.push(full);
        await setDoc(doc(firestore, 'commands', docSnap.id), {
          ...data,
          status: 'DISPATCHED',
          dispatchedAt: new Date().toISOString()
        }, { merge: true });
      }
    }
    return pendingCmds;
  } catch (err) {
    console.error('Error fetching pending commands:', err);
    return [];
  }
}

/**
 * Queues a hardware command for an ESP32 device in Firestore.
 */
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

/**
 * Records execution report from physical hardware terminal.
 * Validates user ID, updates commands collection, creates/updates fingerprints doc in Firestore,
 * and updates terminal slots.
 */
export async function recordCommandResult(report: CommandResultReport): Promise<void> {
  const cleanDeviceId = report.deviceId.trim().toUpperCase();
  const now = new Date().toISOString();
  const db = await readDb();

  // 1. If commandId provided, look up existing command
  let queuedCmd: TerminalCommand | null = null;
  if (report.commandId) {
    queuedCmd = await getCommandById(report.commandId);
  }

  // 2. Resolve User ID (prefer command's user, then report's user, with fuzzy/keypad/slot mapping)
  let resolvedUserId = (report.userId || queuedCmd?.userId || '').trim().toUpperCase();
  let matchedUser = db.users.find(u => u.id === resolvedUserId || u.id.toLowerCase() === resolvedUserId.toLowerCase());

  if (!matchedUser && resolvedUserId) {
    const numericPart = resolvedUserId.replace(/[^0-9]/g, '');
    if (numericPart) {
      matchedUser = db.users.find(u => u.id.replace(/[^0-9]/g, '') === numericPart);
    }
  }

  if (!matchedUser && (report.slotNumber !== undefined || queuedCmd?.slotNumber !== undefined)) {
    const slot = report.slotNumber ?? queuedCmd?.slotNumber;
    if (slot !== undefined) {
      const paddedSlot = String(slot).padStart(3, '0');
      matchedUser = db.users.find(u => u.id.startsWith(paddedSlot));
    }
  }

  // Check if terminal report was for an invalid/non-existent user
  if (!matchedUser && report.type === 'ENROLL_FINGERPRINT' && report.status === 'success') {
    console.warn(`[TERMINAL RESULT] Warning: ENROLL_FINGERPRINT reported for unmapped user '${resolvedUserId || 'UNKNOWN'}'. Cannot link orphaned fingerprint.`);
    if (report.commandId) {
      await setDoc(doc(firestore, 'commands', report.commandId), {
        status: 'FAILED',
        completedAt: now,
        errorReason: `User ID '${resolvedUserId || 'UNKNOWN'}' does not exist in registered directory.`
      }, { merge: true });
    }
    return;
  }

  const finalUserId = matchedUser ? matchedUser.id : resolvedUserId;
  const targetSlot = report.slotNumber ?? queuedCmd?.slotNumber ?? (db.fingerprints.length + 1);

  // 3. Update command document in Firestore
  if (report.commandId) {
    const cmdRef = doc(firestore, 'commands', report.commandId);
    await setDoc(cmdRef, {
      status: report.status === 'success' ? 'COMPLETED' : 'FAILED',
      completedAt: now,
      slotNumber: targetSlot,
      errorReason: report.errorReason,
      userId: finalUserId
    }, { merge: true });
  }

  // 4. Update biometric template mapping in Firestore
  if (report.status === 'success') {
    if (report.type === 'ENROLL_FINGERPRINT' && finalUserId) {
      const existingFp = db.fingerprints.find(f => f.userId === finalUserId);
      const fpId = existingFp ? existingFp.id : `FP_${Date.now()}_${targetSlot}`;

      const updatedFp: Fingerprint = {
        id: fpId,
        userId: finalUserId,
        registrationDate: existingFp?.registrationDate || now,
        status: 'Active',
        slotNumber: targetSlot,
        templateData: report.templateData || existingFp?.templateData || `DY50_FP_${finalUserId}_SLOT_${targetSlot}`,
        enrolledTerminals: Array.from(new Set([...(existingFp?.enrolledTerminals || []), cleanDeviceId]))
      };

      await setDoc(doc(firestore, 'fingerprints', fpId), sanitizeForFirestore(updatedFp), { merge: true });

      // Update terminal device statistics
      const devIndex = db.devices.findIndex(d => d.id === cleanDeviceId);
      if (devIndex !== -1) {
        const totalEnrolled = db.fingerprints.filter(f => f.status === 'Active' && f.enrolledTerminals?.includes(cleanDeviceId)).length;
        db.devices[devIndex].enrolledFingerprints = totalEnrolled;
        db.devices[devIndex].freeSlots = Math.max(0, (db.devices[devIndex].maxSlots || 300) - totalEnrolled);
        db.devices[devIndex].lastSync = now;
        await setDoc(doc(firestore, 'devices', cleanDeviceId), sanitizeForFirestore(db.devices[devIndex]), { merge: true });
      }
    } else if (report.type === 'DELETE_FINGERPRINT' && report.slotNumber !== undefined) {
      const fp = db.fingerprints.find(f => f.slotNumber === report.slotNumber && f.enrolledTerminals?.includes(cleanDeviceId));
      if (fp) {
        fp.enrolledTerminals = fp.enrolledTerminals?.filter(t => t !== cleanDeviceId) || [];
        if (fp.enrolledTerminals.length === 0) {
          fp.status = 'Inactive';
        }
        await setDoc(doc(firestore, 'fingerprints', fp.id), sanitizeForFirestore(fp), { merge: true });
      }

      const devIndex = db.devices.findIndex(d => d.id === cleanDeviceId);
      if (devIndex !== -1) {
        const totalEnrolled = db.fingerprints.filter(f => f.status === 'Active' && f.enrolledTerminals?.includes(cleanDeviceId)).length;
        db.devices[devIndex].enrolledFingerprints = totalEnrolled;
        db.devices[devIndex].freeSlots = Math.max(0, (db.devices[devIndex].maxSlots || 300) - totalEnrolled);
        db.devices[devIndex].lastSync = now;
        await setDoc(doc(firestore, 'devices', cleanDeviceId), sanitizeForFirestore(db.devices[devIndex]), { merge: true });
      }
    }
  }
}

/**
 * Retrieves all registered administrators from Firestore.
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
 * Verifies if an email address belongs to an authorized active administrator.
 */
export async function isAuthorizedAdminEmail(email: string): Promise<{ authorized: boolean; admin?: Administrator }> {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return { authorized: false };

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
    return { authorized: normalized === MASTER_ADMIN_EMAIL.toLowerCase() };
  }
}

export async function addAdministrator(admin: Administrator): Promise<Administrator> {
  const cleanEmail = admin.email.trim().toLowerCase();
  const adminId = admin.id || `admin_${Date.now()}`;
  const record: Administrator = {
    ...admin,
    id: adminId,
    email: cleanEmail,
    addedAt: admin.addedAt || new Date().toISOString()
  };

  await setDoc(doc(firestore, 'administrators', adminId), sanitizeForFirestore(record), { merge: true });
  return record;
}

export async function saveAdministratorDoc(admin: Administrator): Promise<Administrator> {
  return addAdministrator(admin);
}

export async function listAdministrators(): Promise<Administrator[]> {
  return getAdministrators();
}

export async function deleteAdministrator(adminId: string): Promise<void> {
  const admins = await listAdministrators();
  const target = admins.find(a => a.id === adminId);
  if (target?.isMaster || target?.email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()) {
    throw new Error('The Master Administrator account cannot be deleted.');
  }
  await deleteDoc(doc(firestore, 'administrators', adminId));
}

export async function deleteAdministratorDoc(adminId: string): Promise<void> {
  return deleteAdministrator(adminId);
}
