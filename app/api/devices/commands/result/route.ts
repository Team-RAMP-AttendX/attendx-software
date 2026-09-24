import { NextRequest, NextResponse } from 'next/server';
import { recordCommandResult, readDb, writeDb } from '@/lib/db';
import { CommandResultReport } from '@/types';

/**
 * Section 3 of Contract:
 * POST /api/devices/commands/result
 * Receives execution results from the terminal for dashboard-initiated or terminal-initiated operations.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      deviceId,
      commandId,
      type,
      status,
      source = commandId ? 'dashboard' : 'terminal',
      userId,
      slotNumber,
      errorReason,
      timestamp
    } = body;

    if (!deviceId) {
      return NextResponse.json(
        { ok: false, error: 'deviceId is required' },
        { status: 400 }
      );
    }

    if (!type || !['ENROLL_FINGERPRINT', 'DELETE_FINGERPRINT'].includes(type)) {
      return NextResponse.json(
        { ok: false, error: 'Valid type (ENROLL_FINGERPRINT or DELETE_FINGERPRINT) is required' },
        { status: 400 }
      );
    }

    if (!status || !['success', 'error'].includes(status)) {
      return NextResponse.json(
        { ok: false, error: 'status must be "success" or "error"' },
        { status: 400 }
      );
    }

    const report: CommandResultReport = {
      deviceId: String(deviceId).trim().toUpperCase(),
      commandId: commandId ? String(commandId).trim() : undefined,
      type,
      status,
      source,
      userId: userId ? String(userId).trim().toUpperCase() : undefined,
      slotNumber: typeof slotNumber === 'number' ? slotNumber : (slotNumber ? Number(slotNumber) : undefined),
      errorReason: errorReason ? String(errorReason) : undefined,
      timestamp: timestamp || new Date().toISOString()
    };

    // Update database & command status
    await recordCommandResult(report);

    // Update device LCD and status
    const db = await readDb();
    const devIndex = db.devices.findIndex(d => d.id === report.deviceId);
    if (devIndex !== -1) {
      db.devices[devIndex].lastSync = new Date().toISOString();
      if (report.status === 'success') {
        if (report.type === 'ENROLL_FINGERPRINT') {
          db.devices[devIndex].lcdText = [
            '** ENROLL SUCCESS **',
            `User: ${report.userId || 'User'}`,
            `Slot #${report.slotNumber} Saved`,
            'Ready for Scan'
          ];
        } else if (report.type === 'DELETE_FINGERPRINT') {
          db.devices[devIndex].lcdText = [
            '** SLOT CLEARED **',
            `Slot #${report.slotNumber} deleted`,
            'Ready for Scan',
            'Time: Synced'
          ];
        }
      } else {
        db.devices[devIndex].lcdText = [
          '** OP FAILED **',
          `${report.type.substring(0, 16)}`,
          `Err: ${report.errorReason || 'Hardware timeout'}`,
          'Check Terminal'
        ];
      }
      await writeDb(db);
    }

    return NextResponse.json({
      ok: true,
      ack: true,
      message: `Command result recorded successfully for terminal ${report.deviceId}`,
      commandId: report.commandId,
      status: report.status,
      serverTime: new Date().toISOString()
    }, { status: 200 });

  } catch (err: unknown) {
    console.error('Error processing command result:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Internal server error processing command result' },
      { status: 500 }
    );
  }
}
