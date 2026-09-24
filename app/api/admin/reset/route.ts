import { NextResponse } from 'next/server';
import { resetDatabaseToCleanState } from '@/lib/db';

export async function POST() {
  try {
    await resetDatabaseToCleanState();
    return NextResponse.json({
      success: true,
      message: 'Persistent Firestore database successfully reset to clean zero-state across all sidebar pages.',
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    console.error('Reset endpoint error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to reset database', error: String(error) },
      { status: 500 }
    );
  }
}
