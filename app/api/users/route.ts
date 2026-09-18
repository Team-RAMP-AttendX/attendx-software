import { NextResponse } from 'next/server';
import { readDb, writeDb } from '@/lib/db';

export async function GET() {
  try {
    const db = await readDb();
    
    // Sort users by name
    const sorted = [...db.users].sort((a, b) => a.name.localeCompare(b.name));
    
    // Enrich with auth setup status
    const enriched = sorted.map(user => {
      const hasFingerprint = db.fingerprints.some(fp => fp.userId === user.id && fp.status === 'Active');
      const hasPin = !!user.pinHash;
      return {
        ...user,
        hasFingerprint,
        hasPin
      };
    });

    return NextResponse.json(enriched);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const db = await readDb();
    
    const nextIdNum = db.users.length + 1;
    const newId = `USR${String(nextIdNum).padStart(3, '0')}`;
    
    const newUser = {
      id: newId,
      name: body.name,
      role: body.role as 'Student' | 'Staff',
      status: 'Active' as 'Active' | 'Inactive',
      dateRegistered: new Date().toISOString(),
      totalAttendance: 0,
      lateOccurrences: 0,
    };
    
    db.users.push(newUser);
    await writeDb(db);
    
    return NextResponse.json(newUser, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
