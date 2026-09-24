import { NextResponse } from 'next/server';
import { readDb, writeDb } from '@/lib/db';
import { AttendanceRecord } from '@/types';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const db = await readDb();

    // Support both single event and batch upload (from offline SPIFFS storage)
    const rawRecords = Array.isArray(body.batch) ? body.batch : [body];

    // Guarantee chronological ordering for burst replay from multi-hour outages
    const recordsToProcess = [...rawRecords].sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeA - timeB;
    });

    const results: AttendanceRecord[] = [];
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    for (const item of recordsToProcess) {
      let { deviceId, userId, slotNumber, slot, authMode = 'fingerprint', timestamp, offlineBuffered } = item;

      // Local Slot Mapping fallback for hackathon firmware
      const targetSlot = slotNumber !== undefined ? Number(slotNumber) : (slot !== undefined ? Number(slot) : undefined);
      if (!userId && targetSlot !== undefined) {
        const fp = db.fingerprints.find(f => f.slotNumber === targetSlot && f.status === 'Active');
        if (fp) {
          userId = fp.userId;
        }
      }

      if (!userId) continue;

      const cleanUserId = String(userId).trim().toUpperCase();
      const user = db.users.find(u => u.id === cleanUserId);
      if (!user) continue;

      // Use the original physical scan timestamp (ensures punctuality isn't penalized by network delay)
      const eventTime = timestamp ? new Date(timestamp) : new Date();
      const eventDateStr = eventTime.toISOString().split('T')[0];
      const isBuffered = Boolean(offlineBuffered);

      // Check if attendance record already exists for this user on this day
      const existingRecordIndex = db.attendance.findIndex(
        a => a.userId === cleanUserId && a.date === eventDateStr
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
          userId: cleanUserId,
          deviceId: deviceId || 'DEV_TERM_01',
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

    // If deviceId provided, update device lastSync and clear pending records if buffered upload
    if (body.deviceId) {
      const devIndex = db.devices.findIndex(d => d.id === body.deviceId);
      if (devIndex !== -1) {
        db.devices[devIndex].lastSync = new Date().toISOString();
        if (body.batch) {
          db.devices[devIndex].pendingRecords = 0;
        }
      }
    }

    await writeDb(db);

    const firstResult = results[0];
    const user = db.users.find(u => u.id === firstResult?.userId);

    return NextResponse.json({
      ok: true,
      success: true,
      processedCount: results.length,
      attendanceId: firstResult?.id,
      eventId: firstResult?.id,
      records: results,
      displayMessage: user ? `WELCOME, ${user.name.split(' ')[0]}!` : 'ATTENDANCE LOGGED',
      status: firstResult?.status || 'Present'
    }, { status: 201 });
  } catch (err) {
    console.error('Error in checkin handler:', err);
    return NextResponse.json({ error: 'Failed to process check-in event' }, { status: 500 });
  }
}
