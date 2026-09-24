import { NextResponse } from 'next/server';
import { readDb } from '@/lib/db';

export async function GET() {
  try {
    const db = await readDb();
    
    // Sort attendance descending by createdAt
    const sorted = [...db.attendance].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // Enrich with user info and evidence status
    const enriched = sorted.slice(0, 50).map(record => {
      const user = db.users.find(u => u.id === record.userId);
      const matchedImage = db.images.find(img => img.attendanceId === record.id);
      const hasImage = Boolean(matchedImage);
      const evidenceStatus = hasImage 
        ? 'captured' 
        : (record.checkInMode === 'pin' ? 'upload_dropped' : undefined);

      return {
        ...record,
        user: { name: user?.name || 'Unknown', role: user?.role || 'Unknown' },
        hasImage,
        evidenceStatus,
        imageStorageRef: matchedImage?.storageRef,
        offlineBuffered: record.offlineBuffered || false,
        replayedAt: record.replayedAt
      };
    });

    return NextResponse.json(enriched);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch attendance feed' }, { status: 500 });
  }
}
