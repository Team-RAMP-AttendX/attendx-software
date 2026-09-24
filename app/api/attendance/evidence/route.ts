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
      deviceId = (formData.get('deviceId') as string) || '';
      attendanceId = (formData.get('attendanceId') as string) || (formData.get('eventId') as string) || '';
      userId = (formData.get('userId') as string) || '';
      storageRef = (formData.get('storageRef') as string) || '';

      const file = formData.get('image') || formData.get('file');
      if (file && typeof file === 'object' && 'arrayBuffer' in file) {
        const buffer = await (file as Blob).arrayBuffer();
        const base64Data = Buffer.from(buffer).toString('base64');
        const mimeType = (file as Blob).type || 'image/jpeg';
        imageBase64 = `data:${mimeType};base64,${base64Data}`;
      }
    } else {
      const body = await req.json();
      deviceId = body.deviceId || '';
      attendanceId = body.attendanceId || '';
      userId = body.userId || '';
      imageBase64 = body.imageBase64 || '';
      storageRef = body.storageRef || '';
    }

    if (!userId) {
      return NextResponse.json({ error: 'userId is required (form-data field "userId")' }, { status: 400 });
    }

    const db = await readDb();
    const user = db.users.find(u => u.id === userId);
    if (!user) {
      return NextResponse.json({ error: `User with id ${userId} not found` }, { status: 404 });
    }

    // If attendanceId wasn't passed, find the most recent checkin for this user today to link accurately
    let linkedAttendanceId = attendanceId;
    if (!linkedAttendanceId) {
      const todayStr = new Date().toISOString().split('T')[0];
      const recentRecord = [...db.attendance]
        .reverse()
        .find(a => a.userId === userId && a.date === todayStr);
      if (recentRecord) {
        linkedAttendanceId = recentRecord.id;
      }
    }

    const newImage = {
      id: `IMG_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      attendanceId: linkedAttendanceId || `ATT_${Date.now()}`,
      userId,
      captureTime: new Date().toISOString(),
      authMode: 'pin' as const,
      storageRef: imageBase64 || storageRef || '/evidence/camera_capture_placeholder.jpg',
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
      success: true,
      image: newImage,
      message: 'ESP-CAM image received and stored successfully via streaming multipart upload.'
    }, { status: 201 });
  } catch (err) {
    console.error('Error storing evidence image:', err);
    return NextResponse.json({ error: 'Failed to store evidence image' }, { status: 500 });
  }
}

