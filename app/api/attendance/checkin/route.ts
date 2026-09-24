import { NextResponse } from 'next/server';
import { readDb, writeDb } from '@/lib/db';
import { AttendanceRecord } from '@/types';

export async function POST(req: Request) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({
        ok: false,
        success: false,
        error: 'INVALID_JSON',
        message: 'Request body must be valid JSON',
        displayMessage: 'PAYLOAD ERROR'
      }, { status: 400 });
    }

    const db = await readDb();

    // Support single object, direct array, or wrapped in batch / records
    const rawRecords = Array.isArray(body)
      ? body
      : (Array.isArray(body?.batch) ? body.batch : (Array.isArray(body?.records) ? body.records : [body]));

    if (!rawRecords.length || !rawRecords[0]) {
      return NextResponse.json({
        ok: false,
        success: false,
        error: 'EMPTY_PAYLOAD',
        message: 'No check-in records found in payload',
        displayMessage: 'NO DATA'
      }, { status: 400 });
    }

    // Guarantee chronological ordering for burst replay from multi-hour outages
    const recordsToProcess = [...rawRecords].sort((a, b) => {
      const timeA = a?.timestamp || a?.time ? new Date(a.timestamp || a.time).getTime() : 0;
      const timeB = b?.timestamp || b?.time ? new Date(b.timestamp || b.time).getTime() : 0;
      return timeA - timeB;
    });

    const results: AttendanceRecord[] = [];
    const now = new Date();
    let unmappedError: { status: number; error: string; message: string; displayMessage: string } | null = null;

    for (const item of recordsToProcess) {
      if (!item || typeof item !== 'object') continue;

      // Extract fields supporting both camelCase and snake_case
      const rawDeviceId = item.deviceId || item.device_id || item.terminalId || item.terminal_id || body.deviceId || body.device_id || 'DEV_TERM_01';
      const cleanDeviceId = String(rawDeviceId).trim().toUpperCase();

      let userId = item.userId || item.user_id || item.studentId || item.student_id;
      const rawSlot = item.slotNumber ?? item.slot_number ?? item.slot ?? item.fingerId ?? item.finger_id ?? item.pageId ?? item.templateId;
      const targetSlot = rawSlot !== undefined && rawSlot !== null && rawSlot !== '' ? Number(rawSlot) : undefined;

      const rawAuthMode = String(item.authMode || item.auth_mode || item.mode || (targetSlot !== undefined ? 'fingerprint' : 'pin')).toLowerCase();
      const authMode: 'fingerprint' | 'pin' = rawAuthMode.includes('pin') || rawAuthMode.includes('keypad') ? 'pin' : 'fingerprint';

      // 1. If userId is not provided (optical fingerprint match), map slot number to user
      if (!userId && targetSlot !== undefined) {
        const fp = db.fingerprints.find(f => 
          (f.slotNumber === targetSlot || String(f.slotNumber) === String(targetSlot)) && 
          f.status === 'Active'
        );
        if (fp) {
          userId = fp.userId;
        } else {
          unmappedError = {
            status: 404,
            error: 'SLOT_NOT_MAPPED',
            message: `Optical fingerprint slot #${targetSlot} is not mapped to an enrolled user on ${cleanDeviceId}. Please enroll via Dashboard or Terminal Menu first.`,
            displayMessage: 'SLOT NOT FOUND'
          };
          continue;
        }
      }

      if (!userId) {
        if (!unmappedError) {
          unmappedError = {
            status: 400,
            error: 'MISSING_IDENTIFIER',
            message: 'Either slotNumber (for DY50 fingerprint) or userId (for keypad PIN) is required in the check-in payload.',
            displayMessage: 'IDENTIFIER REQ'
          };
        }
        continue;
      }

      const cleanUserId = String(userId).trim().toUpperCase();
      const user = db.users.find(u => u.id === cleanUserId || u.id.toLowerCase() === cleanUserId.toLowerCase());
      if (!user) {
        unmappedError = {
          status: 404,
          error: 'USER_NOT_FOUND',
          message: `User '${cleanUserId}' was not found in the registered student/staff directory.`,
          displayMessage: 'INVALID USER'
        };
        continue;
      }

      // Timestamp parsing: accept ISO string, or numeric epoch (seconds or ms)
      let eventTime = new Date();
      const rawTimestamp = item.timestamp || item.time || item.datetime || item.dateTime || item.epoch;
      if (rawTimestamp) {
        if (typeof rawTimestamp === 'number') {
          // If epoch in seconds (10 digits), convert to ms
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

      // Check if attendance record already exists for this user on this day
      const existingRecordIndex = db.attendance.findIndex(
        a => a.userId === user.id && a.date === eventDateStr
      );

      let record: AttendanceRecord;

      if (existingRecordIndex !== -1) {
        // Record check-out
        record = {
          ...db.attendance[existingRecordIndex],
          checkOutTime: eventTime.toISOString(),
          checkOutMode: authMode,
          syncStatus: 'Synced',
          offlineBuffered: isBuffered || db.attendance[existingRecordIndex].offlineBuffered,
          replayedAt: isBuffered ? now.toISOString() : db.attendance[existingRecordIndex].replayedAt
        };
        db.attendance[existingRecordIndex] = record;
      } else {
        // Record check-in
        const checkInHour = eventTime.getHours();
        const checkInMinute = eventTime.getMinutes();
        
        // Threshold: 9:00 AM based on physical scan timestamp
        const isLate = checkInHour > 9 || (checkInHour === 9 && checkInMinute > 0);
        const lateMinutes = isLate ? ((checkInHour - 9) * 60 + checkInMinute) : 0;
        const status = isLate ? 'Late' : 'Present';

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
          offlineBuffered: isBuffered,
          replayedAt: isBuffered ? now.toISOString() : undefined,
          hasImage: false,
          evidenceStatus: authMode === 'pin' ? 'not_captured' : undefined
        };

        db.attendance.push(record);
        
        // Update user stats
        user.totalAttendance += 1;
        if (isLate) {
          user.lateOccurrences += 1;
        }
      }

      results.push(record);
    }

    // If single request had an error and no records succeeded, return explicit failure schema
    if (results.length === 0 && unmappedError) {
      return NextResponse.json({
        ok: false,
        success: false,
        error: unmappedError.error,
        message: unmappedError.message,
        displayMessage: unmappedError.displayMessage,
        processedCount: 0
      }, { status: unmappedError.status });
    }

    // Update device lastSync and LCD status for the terminal
    const targetDeviceId = recordsToProcess[0]?.deviceId || recordsToProcess[0]?.device_id || body.deviceId || body.device_id;
    if (targetDeviceId) {
      const cleanDevId = String(targetDeviceId).trim().toUpperCase();
      const devIndex = db.devices.findIndex(d => d.id === cleanDevId);
      if (devIndex !== -1) {
        db.devices[devIndex].lastSync = now.toISOString();
        db.devices[devIndex].status = 'ONLINE';
        db.devices[devIndex].wifiStatus = 'Connected';
        if (body.batch || Array.isArray(body)) {
          db.devices[devIndex].pendingRecords = 0;
        }
        if (results.length > 0) {
          const firstUser = db.users.find(u => u.id === results[0]?.userId);
          const firstName = firstUser ? firstUser.name.split(' ')[0] : 'User';
          db.devices[devIndex].lcdText = [
            '** ATTENDX TERMINAL **',
            `Scan: ${firstName}`,
            `Status: ${results[0]?.status || 'Present'}`,
            'Net: CONNECTED'
          ];
        }
      }
    }

    await writeDb(db);

    const firstResult = results[0];
    const user = db.users.find(u => u.id === firstResult?.userId);
    const firstName = user ? user.name.split(' ')[0].toUpperCase() : 'USER';
    const isLate = firstResult?.status === 'Late';

    return NextResponse.json({
      ok: true,
      success: true,
      processedCount: results.length,
      attendanceId: firstResult?.id,
      eventId: firstResult?.id,
      userId: user?.id,
      userName: user?.name,
      userRole: user?.role,
      status: firstResult?.status || 'Present',
      isLate,
      lateMinutes: firstResult?.lateDurationMinutes || 0,
      displayMessage: isLate 
        ? `LATE: ${firstName} (+${firstResult?.lateDurationMinutes || 0}m)` 
        : `WELCOME, ${firstName}!`,
      checkInTime: firstResult?.checkInTime,
      records: results,
      serverTime: now.toISOString()
    }, { status: 201 });
  } catch (err) {
    console.error('Error in checkin handler:', err);
    return NextResponse.json({ 
      ok: false, 
      success: false, 
      error: 'SERVER_ERROR', 
      message: 'Failed to process check-in event: ' + (err instanceof Error ? err.message : String(err)),
      displayMessage: 'SYSTEM ERROR'
    }, { status: 500 });
  }
}
