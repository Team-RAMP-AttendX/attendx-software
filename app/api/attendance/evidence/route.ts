import { NextResponse } from 'next/server';
import { readDb } from '@/lib/db';

export async function GET() {
  try {
    const db = await readDb();
    
    const enriched = db.images.map(img => {
      const user = db.users.find(u => u.id === img.userId);
      const attendance = db.attendance.find(a => a.id === img.attendanceId);
      return {
        ...img,
        user: { name: user?.name || 'Unknown', role: user?.role || 'Unknown' },
        attendance: { date: attendance?.date, status: attendance?.status }
      };
    });
    
    // Sort descending
    enriched.sort((a, b) => new Date(b.captureTime).getTime() - new Date(a.captureTime).getTime());

    return NextResponse.json(enriched);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch evidence' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { deviceId, attendanceId, userId, imageBase64, storageRef } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const db = await readDb();
    const user = db.users.find(u => u.id === userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const newImage = {
      id: `IMG_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      attendanceId: attendanceId || `ATT_${Date.now()}`,
      userId,
      captureTime: new Date().toISOString(),
      authMode: 'pin' as const,
      storageRef: storageRef || imageBase64 || '/evidence/camera_capture_placeholder.jpg'
    };

    db.images.unshift(newImage);
    const { writeDb } = await import('@/lib/db');
    await writeDb(db);

    return NextResponse.json({
      success: true,
      image: newImage,
      message: 'ESP-CAM photo evidence stored successfully'
    }, { status: 201 });
  } catch (err) {
    console.error('Error storing evidence image:', err);
    return NextResponse.json({ error: 'Failed to store evidence image' }, { status: 500 });
  }
}

