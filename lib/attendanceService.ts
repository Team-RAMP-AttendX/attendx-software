import { readDb, saveAttendanceDoc, saveUserDoc } from '@/lib/db';
import { AttendanceRecord, User, Fingerprint } from '@/types';

export interface ProcessAttendanceOptions {
  forcedDirection?: 'IN' | 'OUT';
}

export interface AttendanceResultResponse {
  ok: boolean;
  success: boolean;
  eventType?: 'CHECK_IN' | 'CHECK_OUT';
  processedCount?: number;
  attendanceId?: string;
  eventId?: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  status?: string;
  isLate?: boolean;
  lateMinutes?: number;
  displayMessage: string;
  checkInTime?: string;
  checkOutTime?: string;
  records?: AttendanceRecord[];
  serverTime: string;
  error?: string;
  message?: string;
}

export async function processAttendancePayload(
  payload: any,
  options: ProcessAttendanceOptions = {}
): Promise<{ statusCode: number; data: AttendanceResultResponse }> {
  const db = await readDb();
  const now = new Date();

  // Support single object, direct array, or wrapped in batch / records
  const rawRecords = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.batch)
    ? payload.batch
    : Array.isArray(payload?.records)
    ? payload.records
    : [payload];

  if (!rawRecords.length || !rawRecords[0]) {
    return {
      statusCode: 400,
      data: {
        ok: false,
        success: false,
        error: 'EMPTY_PAYLOAD',
        message: 'No check-in/check-out records found in payload',
        displayMessage: 'NO DATA',
        serverTime: now.toISOString()
      }
    };
  }

  // Guarantee chronological ordering for burst replay from multi-hour outages
  const recordsToProcess = [...rawRecords].sort((a, b) => {
    const timeA = a?.timestamp || a?.time ? new Date(a.timestamp || a.time).getTime() : 0;
    const timeB = b?.timestamp || b?.time ? new Date(b.timestamp || b.time).getTime() : 0;
    return timeA - timeB;
  });

  const results: AttendanceRecord[] = [];
  let unmappedError: { status: number; error: string; message: string; displayMessage: string } | null = null;
  let lastProcessedDirection: 'CHECK_IN' | 'CHECK_OUT' = 'CHECK_IN';
  let lastProcessedUser: User | undefined;

  for (const item of recordsToProcess) {
    if (!item || typeof item !== 'object') continue;

    // Extract fields supporting both camelCase and snake_case
    const rawDeviceId =
      item.deviceId ||
      item.device_id ||
      item.terminalId ||
      item.terminal_id ||
      payload.deviceId ||
      payload.device_id ||
      'DEV_TERM_01';
    const cleanDeviceId = String(rawDeviceId).trim().toUpperCase();

    let userId = item.userId || item.user_id || item.studentId || item.student_id || item.id || item.uid;
    const rawSlot =
      item.slotNumber ??
      item.slot_number ??
      item.slot ??
      item.slotId ??
      item.slot_id ??
      item.fingerprintId ??
      item.fingerprint_id ??
      item.fingerPrintId ??
      item.fingerId ??
      item.finger_id ??
      item.fingerIndex ??
      item.finger_index ??
      item.printId ??
      item.print_id ??
      item.pageId ??
      item.page_id ??
      item.templateId ??
      item.template_id;
    const targetSlot = rawSlot !== undefined && rawSlot !== null && rawSlot !== '' ? Number(rawSlot) : undefined;

    const rawAuthMode = String(
      item.authMode || item.auth_mode || item.mode || (targetSlot !== undefined ? 'fingerprint' : 'pin')
    ).toLowerCase();
    const authMode: 'fingerprint' | 'pin' =
      rawAuthMode.includes('pin') || rawAuthMode.includes('keypad') ? 'pin' : 'fingerprint';

    // 1. If userId is not provided (optical fingerprint match), map slot number to user
    if (!userId && targetSlot !== undefined) {
      const fp = db.fingerprints.find(
        f =>
          (f.slotNumber === targetSlot || String(f.slotNumber) === String(targetSlot)) &&
          f.status === 'Active'
      );

      if (!fp) {
        // Try user matching slot number (e.g. slot 1 -> '001A', '001B', 'USR001', or index)
        const paddedNum = String(targetSlot).padStart(3, '0');
        const matchedUser =
          db.users.find(u => u.id.toUpperCase().startsWith(paddedNum)) ||
          db.users.find(u => u.id.toUpperCase() === `USR${paddedNum}`) ||
          db.users.find(u => u.id.includes(String(targetSlot)));

        if (matchedUser) {
          userId = matchedUser.id;
          const newFp: Fingerprint = {
            id: `FP_${Date.now()}_${targetSlot}`,
            userId: matchedUser.id,
            registrationDate: now.toISOString(),
            status: 'Active',
            slotNumber: targetSlot,
            templateData: `DY50_FP_${matchedUser.id}_SLOT_${targetSlot}`,
            enrolledTerminals: [cleanDeviceId]
          };
          db.fingerprints.push(newFp);
        } else {
          unmappedError = {
            status: 404,
            error: 'SLOT_NOT_MAPPED',
            message: `Optical fingerprint slot #${targetSlot} is not mapped to an enrolled user on ${cleanDeviceId}. Please enroll via Dashboard or Terminal Menu first.`,
            displayMessage: 'SLOT NOT FOUND'
          };
          continue;
        }
      } else {
        userId = fp.userId;
      }
    }

    if (!userId) {
      if (!unmappedError) {
        unmappedError = {
          status: 400,
          error: 'MISSING_IDENTIFIER',
          message:
            'Either slotNumber (for DY50 fingerprint) or userId (for keypad PIN) is required in the check-in payload.',
          displayMessage: 'IDENTIFIER REQ'
        };
      }
      continue;
    }

    const cleanUserId = String(userId).trim().toUpperCase();
    let user =
      db.users.find(u => u.id.toUpperCase() === cleanUserId || u.id.toLowerCase() === cleanUserId.toLowerCase()) ||
      db.users.find(u => u.name.toLowerCase() === cleanUserId.toLowerCase());

    if (!user) {
      // Fuzzy fallback for keypad entry (e.g. '001' or '1' matches '001A')
      const numericPart = cleanUserId.replace(/[^0-9]/g, '');
      if (numericPart) {
        user = db.users.find(u => u.id.replace(/[^0-9]/g, '') === numericPart);
      }
    }

    if (!user) {
      if (!unmappedError) {
        unmappedError = {
          status: 404,
          error: 'SLOT_NOT_MAPPED',
          message: `User ID '${cleanUserId}' (or associated slot) is not mapped to an enrolled user on ${cleanDeviceId}. Please enroll via Dashboard first.`,
          displayMessage: 'USER NOT FOUND'
        };
      }
      continue;
    }

    lastProcessedUser = user;

    // Timestamp parsing: accept ISO string, or numeric epoch (seconds or ms)
    let eventTime = new Date();
    const rawTimestamp = item.timestamp || item.time || item.datetime || item.dateTime || item.epoch;
    if (rawTimestamp) {
      if (typeof rawTimestamp === 'number') {
        eventTime = new Date(rawTimestamp < 10000000000 ? rawTimestamp * 1000 : rawTimestamp);
      } else {
        const parsed = new Date(rawTimestamp);
        if (!isNaN(parsed.getTime())) {
          eventTime = parsed;
        }
      }
    }

    const eventDateStr = eventTime.toISOString().split('T')[0];
    const isBuffered = Boolean(item.offlineBuffered ?? item.offline_buffered ?? item.buffered ?? item.offline);

    // Determine direction (IN vs OUT)
    const rawDirection = String(
      item.direction ||
        item.action ||
        item.eventType ||
        item.event_type ||
        item.type ||
        options.forcedDirection ||
        ''
    ).toUpperCase();

    const isExplicitOut =
      rawDirection.includes('OUT') ||
      rawDirection.includes('EXIT') ||
      rawDirection.includes('DEPART') ||
      rawDirection.includes('LEAVE');
    const isExplicitIn =
      rawDirection.includes('IN') ||
      rawDirection.includes('ENTRY') ||
      rawDirection.includes('ARRIV') ||
      rawDirection.includes('ENTER');

    // Check if attendance record already exists for this user on this day
    const existingRecordIndex = db.attendance.findIndex(
      a => a.userId === user.id && a.date === eventDateStr
    );

    let record: AttendanceRecord;

    // Determine whether this event should be a Check-Out or Check-In
    const shouldCheckOut =
      isExplicitOut ||
      (!isExplicitIn && existingRecordIndex !== -1 && db.attendance[existingRecordIndex].checkInTime && !db.attendance[existingRecordIndex].checkOutTime);

    if (shouldCheckOut) {
      lastProcessedDirection = 'CHECK_OUT';
      if (existingRecordIndex !== -1) {
        record = {
          ...db.attendance[existingRecordIndex],
          checkOutTime: eventTime.toISOString(),
          checkOutMode: authMode,
          syncStatus: 'Synced'
        };
        if (isBuffered || db.attendance[existingRecordIndex].offlineBuffered) {
          record.offlineBuffered = true;
          record.replayedAt = now.toISOString();
        }
        db.attendance[existingRecordIndex] = record;
      } else {
        record = {
          id: `ATT_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          userId: user.id,
          deviceId: cleanDeviceId,
          date: eventDateStr,
          checkOutTime: eventTime.toISOString(),
          checkOutMode: authMode,
          status: 'Present',
          lateDurationMinutes: 0,
          syncStatus: 'Synced',
          createdAt: eventTime.toISOString(),
          hasImage: false
        };
        if (isBuffered) {
          record.offlineBuffered = true;
          record.replayedAt = now.toISOString();
        }
        db.attendance.push(record);
        user.totalAttendance = (user.totalAttendance || 0) + 1;
      }
    } else {
      // Check-In
      lastProcessedDirection = 'CHECK_IN';
      const checkInHour = eventTime.getHours();
      const checkInMinute = eventTime.getMinutes();

      // Threshold: 9:00 AM based on physical scan timestamp
      const isLate = checkInHour > 9 || (checkInHour === 9 && checkInMinute > 0);
      const lateMinutes = isLate ? (checkInHour - 9) * 60 + checkInMinute : 0;
      const status = isLate ? 'Late' : 'Present';

      if (existingRecordIndex !== -1) {
        record = {
          ...db.attendance[existingRecordIndex],
          checkInTime: eventTime.toISOString(),
          checkInMode: authMode,
          status,
          lateDurationMinutes: lateMinutes,
          syncStatus: 'Synced'
        };
        if (isBuffered || db.attendance[existingRecordIndex].offlineBuffered) {
          record.offlineBuffered = true;
        }
        db.attendance[existingRecordIndex] = record;
      } else {
        record = {
          id: `ATT_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          userId: user.id,
          deviceId: cleanDeviceId,
          date: eventDateStr,
          checkInTime: eventTime.toISOString(),
          checkInMode: authMode,
          status,
          lateDurationMinutes: lateMinutes,
          syncStatus: 'Synced',
          createdAt: eventTime.toISOString(),
          hasImage: false
        };
        if (isBuffered) {
          record.offlineBuffered = true;
          record.replayedAt = now.toISOString();
        }
        if (authMode === 'pin') {
          record.evidenceStatus = 'not_captured';
        }

        db.attendance.push(record);

        // Update user stats
        user.totalAttendance = (user.totalAttendance || 0) + 1;
        if (isLate) {
          user.lateOccurrences = (user.lateOccurrences || 0) + 1;
        }
      }
    }

    // Persist doc directly
    await saveAttendanceDoc(record);
    await saveUserDoc(user);

    results.push(record);
  }

  // If single request had an error and no records succeeded, return explicit failure schema
  if (results.length === 0 && unmappedError) {
    return {
      statusCode: unmappedError.status,
      data: {
        ok: false,
        success: false,
        error: unmappedError.error,
        message: unmappedError.message,
        displayMessage: unmappedError.displayMessage,
        processedCount: 0,
        serverTime: now.toISOString()
      }
    };
  }

  // Update device lastSync and LCD status for the terminal
  const targetDeviceId =
    recordsToProcess[0]?.deviceId ||
    recordsToProcess[0]?.device_id ||
    payload.deviceId ||
    payload.device_id;
  if (targetDeviceId) {
    const cleanDevId = String(targetDeviceId).trim().toUpperCase();
    const devIndex = db.devices.findIndex(d => d.id === cleanDevId);
    if (devIndex !== -1) {
      db.devices[devIndex].lastSync = now.toISOString();
      db.devices[devIndex].status = 'ONLINE';
      db.devices[devIndex].wifiStatus = 'Connected';
      if (payload.batch || Array.isArray(payload)) {
        db.devices[devIndex].pendingRecords = 0;
      }
      if (results.length > 0) {
        const firstUser = db.users.find(u => u.id === results[0]?.userId);
        const firstName = firstUser ? firstUser.name.split(' ')[0] : 'User';
        const actionLabel = lastProcessedDirection === 'CHECK_OUT' ? 'OUT' : 'IN';
        db.devices[devIndex].lcdText = [
          '** ATTENDX TERMINAL **',
          `${actionLabel}: ${firstName}`,
          `Status: ${results[0]?.status || 'Present'}`,
          'Net: CONNECTED'
        ];
      }
    }
  }

  // Persist device status update only — attendance and user docs already saved above
  if (targetDeviceId) {
    const cleanDevId = String(targetDeviceId).trim().toUpperCase();
    const devIndex = db.devices.findIndex(d => d.id === cleanDevId);
    if (devIndex !== -1) {
      const { saveDeviceDoc } = await import('@/lib/db');
      await saveDeviceDoc(db.devices[devIndex]);
    }
  }

  const firstResult = results[0];
  const user = lastProcessedUser || db.users.find(u => u.id === firstResult?.userId);
  const firstName = user ? user.name.split(' ')[0].toUpperCase() : 'USER';
  const isLate = firstResult?.status === 'Late';

  let displayMessage = `WELCOME, ${firstName}!`;
  if (lastProcessedDirection === 'CHECK_OUT') {
    displayMessage = `GOODBYE, ${firstName}!`;
  } else if (isLate) {
    displayMessage = `LATE: ${firstName} (+${firstResult?.lateDurationMinutes || 0}m)`;
  }

  return {
    statusCode: 201,
    data: {
      ok: true,
      success: true,
      eventType: lastProcessedDirection,
      processedCount: results.length,
      attendanceId: firstResult?.id,
      eventId: firstResult?.id,
      userId: user?.id,
      userName: user?.name,
      userRole: user?.role,
      status: firstResult?.status || 'Present',
      isLate,
      lateMinutes: firstResult?.lateDurationMinutes || 0,
      displayMessage,
      checkInTime: firstResult?.checkInTime,
      checkOutTime: firstResult?.checkOutTime,
      records: results,
      serverTime: now.toISOString()
    }
  };
}
