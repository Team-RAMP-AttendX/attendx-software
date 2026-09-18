import { NextResponse } from 'next/server';
import { readDb } from '@/lib/db';

export async function GET() {
  try {
    const db = await readDb();
    return NextResponse.json(db.devices);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch devices' }, { status: 500 });
  }
}
