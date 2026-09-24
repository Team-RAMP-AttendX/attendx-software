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
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, ack: false, error: 'Request body must be valid JSON' }, { status: 400 });
    }

    const rawDeviceId = body.deviceId || body.device_id || body.terminalId || body.terminal_id;
    if (!rawDeviceId) {
      return NextResponse.json(
        { ok: false, ack: false, error: 'deviceId is required in command result payload' },
        { status: 400 }
      );
    }

    const commandId = body.commandId || body.command_id || body.id;
    const rawType = String(body.type || body.commandType || body.command_type || '').toUpperCase();
    let normalizedType: 'ENROLL_FINGERPRINT' | 'DELETE_FINGERPRINT' = 'ENROLL_FINGERPRINT';

    if (rawType.includes('ENROLL')) {
      normalizedType = 'ENROLL_FINGERPRINT';
    } else if (rawType.includes('DELETE') || rawType.includes('REMOVE') || rawType.includes('CLEAR')) {
      normalizedType = 'DELETE_FINGERPRINT';
    } else {
      return NextResponse.json(
        { ok: false, ack: false, error: 'Valid type (ENROLL_FINGERPRINT or DELETE_FINGERPRINT) is required' },
        { status: 400 }
      );
    }

    const rawStatus = String(body.status || '').toLowerCase();
    const normalizedStatus: 'success' | 'error' = (rawStatus === 'success' || rawStatus === 'ok' || rawStatus === 'completed' || rawStatus === 'true')
      ? 'success'
      : 'error';

    const rawSlot = body.slotNumber ?? body.slot_number ?? body.slot ?? body.fingerId ?? body.finger_id;
    const slotNumber = rawSlot !== undefined && rawSlot !== null && rawSlot !== '' ? Number(rawSlot) : undefined;

    const rawUserId = body.userId || body.user_id || body.studentId;
    const userId = rawUserId ? String(rawUserId).trim().toUpperCase() : undefined;

    const errorReason = body.errorReason || body.error_reason || body.reason || body.error;
    const source: 'dashboard' | 'terminal' = body.source || (commandId ? 'dashboard' : 'terminal');

    const report: CommandResultReport = {
      deviceId: String(rawDeviceId).trim().toUpperCase(),
      commandId: commandId ? String(commandId).trim() : undefined,
      type: normalizedType,
      status: normalizedStatus,
      source,
      userId,
      slotNumber,
      errorReason: errorReason ? String(errorReason) : undefined,
      timestamp: body.timestamp || body.time || new Date().toISOString()
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
            `Slot #${report.slotNumber || '?'} Saved`,
            'Ready for Scan'
          ];
        } else if (report.type === 'DELETE_FINGERPRINT') {
          db.devices[devIndex].lcdText = [
            '** SLOT CLEARED **',
            `Slot #${report.slotNumber || '?'} deleted`,
            'Ready for Scan',
            'Time: Synced'
          ];
        }
      } else {
        db.devices[devIndex].lcdText = [
          '** OP FAILED **',
          `${report.type.substring(0, 16)}`,
          `Err: ${(report.errorReason || 'Hardware timeout').substring(0, 16)}`,
          'Check Terminal'
        ];
      }
      await writeDb(db);
    }

    return NextResponse.json({
      ok: true,
      ack: true,
      success: true,
      message: `Command result recorded successfully for terminal ${report.deviceId}`,
      commandId: report.commandId,
      status: report.status,
      slotNumber: report.slotNumber,
      serverTime: new Date().toISOString()
    }, { status: 200 });

  } catch (err: unknown) {
    console.error('Error processing command result:', err);
    return NextResponse.json(
      { ok: false, ack: false, error: err instanceof Error ? err.message : 'Internal server error processing command result' },
      { status: 500 }
    );
  }
}
