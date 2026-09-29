import { NextRequest, NextResponse } from 'next/server';
import { readDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = id;
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const db = await readDb();
    
    // Find user (case insensitive)
    const cleanUserId = userId.trim().toUpperCase();
    const user = db.users.find(u => u.id.toUpperCase() === cleanUserId);

    if (!user) {
      return NextResponse.json({ exists: false, hasFingerprint: false }, { status: 404 });
    }

    // Check if user has an active fingerprint enrolled
    const activeFp = db.fingerprints.find(f => f.userId.toUpperCase() === cleanUserId && f.status === 'Active');

    return NextResponse.json({
      exists: true,
      hasFingerprint: !!activeFp
    }, { status: 200 });

  } catch (err) {
    console.error('Error fetching user status:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
