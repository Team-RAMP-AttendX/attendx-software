import { NextResponse } from 'next/server';
import { readDb } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const role = searchParams.get('role');
    const mode = searchParams.get('mode');
    
    const db = await readDb();
    
    let records = [...db.attendance].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // Enrich early to allow filtering by role
    let enriched = records.map(record => {
      const user = db.users.find(u => u.id === record.userId);
      const hasImage = db.images.some(img => img.attendanceId === record.id);
      return {
        ...record,
        user: { name: user?.name || 'Unknown', role: user?.role || 'Unknown' },
        hasImage
      };
    });

    if (date) enriched = enriched.filter(r => r.date === date);
    if (role && role !== 'All') enriched = enriched.filter(r => r.user.role === role);
    if (mode && mode !== 'All') enriched = enriched.filter(r => r.checkInMode === mode.toLowerCase() || r.checkOutMode === mode.toLowerCase());

    return NextResponse.json(enriched);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
