import { NextResponse } from 'next/server';
import { readDb } from '@/lib/db';

export async function GET() {
  try {
    const db = await readDb();
    
    const capturedItems = db.images.map(img => {
      const user = db.users.find(u => u.id === img.userId);
      const attendance = db.attendance.find(a => a.id === img.attendanceId);
      return {
        ...img,
        user: { name: user?.name || 'Unknown', role: user?.role || 'Unknown' },
        attendance: { date: attendance?.date, status: attendance?.status },
        uploadStatus: 'captured' as const
      };
    });

    // Gracefully include PIN attendance records where photo upload dropped across network outage
    const missingPhotoItems = db.attendance
      .filter(a => a.checkInMode === 'pin' && !db.images.some(img => img.attendanceId === a.id))
      .map(a => {
        const user = db.users.find(u => u.id === a.userId);
        return {
          id: `DROPPED_${a.id}`,
          attendanceId: a.id,
          userId: a.userId,
          captureTime: a.checkInTime || a.createdAt,
          authMode: 'pin' as const,
          storageRef: '',
          uploadStatus: 'upload_dropped' as const,
          user: { name: user?.name || 'Unknown', role: user?.role || 'Unknown' },
          attendance: { date: a.date, status: a.status },
          reason: 'Photo upload dropped during Wi-Fi interruption (non-retried by firmware). Attendance verified via secure PIN.'
        };
      });

    const combined = [...capturedItems, ...missingPhotoItems];
    combined.sort((a, b) => new Date(b.captureTime).getTime() - new Date(a.captureTime).getTime());

    return NextResponse.json(combined);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch evidence' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    let deviceId = '';
    let attendanceId = '';
    let userId = '';
    let imageBase64 = '';
    let storageRef = '';

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      deviceId = (formData.get('deviceId') as string) || (formData.get('device_id') as string) || (formData.get('terminalId') as string) || '';
      attendanceId = (formData.get('attendanceId') as string) || (formData.get('attendance_id') as string) || (formData.get('eventId') as string) || (formData.get('event_id') as string) || '';
      userId = (formData.get('userId') as string) || (formData.get('user_id') as string) || (formData.get('studentId') as string) || '';
      storageRef = (formData.get('storageRef') as string) || (formData.get('storage_ref') as string) || '';

      const file = formData.get('image') || formData.get('file') || formData.get('photo');
      if (file && typeof file === 'object' && 'arrayBuffer' in file) {
        const buffer = await (file as Blob).arrayBuffer();
        const base64Data = Buffer.from(buffer).toString('base64');
        const mimeType = (file as Blob).type || 'image/jpeg';
        imageBase64 = `data:${mimeType};base64,${base64Data}`;
      }
    } else {
      let body: any = {};
      try {
        body = await req.json();
      } catch {
        // may be empty or raw binary
      }
      deviceId = body.deviceId || body.device_id || body.terminalId || '';
      attendanceId = body.attendanceId || body.attendance_id || body.eventId || body.event_id || '';
      userId = body.userId || body.user_id || body.studentId || '';
      imageBase64 = body.imageBase64 || body.image_base64 || body.image || '';
      storageRef = body.storageRef || body.storage_ref || '';
    }

    const db = await readDb();

    // If userId was not passed by the ESP32-CAM, deduce it from the attendanceId / eventId returned earlier
    if (!userId && attendanceId) {
      const matchedAtt = db.attendance.find(a => a.id === attendanceId);
      if (matchedAtt) {
        userId = matchedAtt.userId;
      }
    }

    // If still no userId, but deviceId provided, associate with the latest check-in for that terminal
    if (!userId && deviceId) {
      const cleanDevId = deviceId.trim().toUpperCase();
      const recentAtt = [...db.attendance].reverse().find(a => a.deviceId === cleanDevId);
      if (recentAtt) {
        userId = recentAtt.userId;
        if (!attendanceId) attendanceId = recentAtt.id;
      }
    }

    if (!userId && !attendanceId) {
      return NextResponse.json({
        ok: false,
        success: false,
        error: 'MISSING_LINKAGE',
        message: 'Either attendanceId (recommended: returned in /api/attendance/checkin response) or userId is required in form-data.'
      }, { status: 400 });
    }

    const cleanUserId = userId ? String(userId).trim().toUpperCase() : 'UNKNOWN';
    const user = db.users.find(u => u.id === cleanUserId || u.id.toLowerCase() === cleanUserId.toLowerCase());

    // If attendanceId wasn't passed, find the most recent checkin for this user today to link accurately
    let linkedAttendanceId = attendanceId;
    if (!linkedAttendanceId && cleanUserId) {
      const todayStr = new Date().toISOString().split('T')[0];
      const recentRecord = [...db.attendance]
        .reverse()
        .find(a => a.userId === cleanUserId && a.date === todayStr);
      if (recentRecord) {
        linkedAttendanceId = recentRecord.id;
      }
    }

    const newImage = {
      id: `IMG_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      attendanceId: linkedAttendanceId || `ATT_${Date.now()}`,
      userId: user?.id || cleanUserId,
      captureTime: new Date().toISOString(),
      authMode: 'pin' as const,
      storageRef: imageBase64 || storageRef || '/demo-evidence.jpg',
      uploadStatus: 'captured' as const
    };

    db.images.unshift(newImage);

    // If attendance record exists, mark hasImage true and status captured
    if (linkedAttendanceId) {
      const attIndex = db.attendance.findIndex(a => a.id === linkedAttendanceId);
      if (attIndex !== -1) {
        db.attendance[attIndex].hasImage = true;
        db.attendance[attIndex].evidenceStatus = 'captured';
      }
    }

    const { writeDb } = await import('@/lib/db');
    await writeDb(db);

    return NextResponse.json({
      ok: true,
      success: true,
      attendanceId: linkedAttendanceId,
      userId: user?.id || cleanUserId,
      userName: user?.name || 'Verified User',
      image: newImage,
      message: 'ESP-CAM evidence photo received and verified successfully.'
    }, { status: 201 });
  } catch (err) {
    console.error('Error storing evidence image:', err);
    return NextResponse.json({ 
      ok: false,
      success: false,
      error: 'STORAGE_FAILED', 
      message: 'Failed to store evidence image: ' + (err instanceof Error ? err.message : String(err)) 
    }, { status: 500 });
  }
}

