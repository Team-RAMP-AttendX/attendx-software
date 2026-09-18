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
