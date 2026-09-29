import { NextResponse } from 'next/server';
import { readDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await readDb();
    
    // Sort attendance descending by most recent activity (checkOutTime vs checkInTime vs createdAt)
    const sorted = [...db.attendance].sort((a, b) => {
      const timeB = Math.max(
        new Date(b.checkOutTime || 0).getTime(),
        new Date(b.checkInTime || b.createdAt).getTime()
      );
      const timeA = Math.max(
        new Date(a.checkOutTime || 0).getTime(),
        new Date(a.checkInTime || a.createdAt).getTime()
      );
      return timeB - timeA;
    });
    
    // Enrich with user info and evidence status
    const enriched = sorted.slice(0, 50).map(record => {
      const user = db.users.find(u => u.id === record.userId);
      const matchedImage = db.images.find(img => img.attendanceId === record.id);
      const hasImage = Boolean(matchedImage);
      const evidenceStatus = hasImage 
        ? 'captured' 
        : (record.checkInMode === 'pin' ? 'upload_dropped' : undefined);

      const isCheckedOut = Boolean(record.checkOutTime);
      const lastEventType = isCheckedOut ? 'CHECK_OUT' : 'CHECK_IN';
      const lastEventTime = record.checkOutTime || record.checkInTime || record.createdAt;
      const lastEventMode = isCheckedOut ? (record.checkOutMode || record.checkInMode) : record.checkInMode;

      return {
        ...record,
        user: { name: user?.name || 'Unknown', role: user?.role || 'Unknown' },
        hasImage,
        evidenceStatus,
        imageStorageRef: matchedImage?.storageRef,
        offlineBuffered: record.offlineBuffered || false,
        replayedAt: record.replayedAt,
        isCheckedOut,
        lastEventType,
        lastEventTime,
        lastEventMode
      };
    });

    return NextResponse.json(enriched);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch attendance feed' }, { status: 500 });
  }
}
