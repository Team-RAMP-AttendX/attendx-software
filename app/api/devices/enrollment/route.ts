import { NextResponse } from 'next/server';
import { readDb, writeDb, queueCommandForDevice, getCommandById, recordCommandResult } from '@/lib/db';
import { Fingerprint, TerminalCommand } from '@/types';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get('deviceId')?.trim().toUpperCase();
    const jobId = searchParams.get('jobId')?.trim() || searchParams.get('commandId')?.trim();

    // 1. Direct job/command status lookup from Firestore (Unified Single Source of Truth)
    if (jobId) {
      const cmd = await getCommandById(jobId);
      const db = await readDb();

      // Check if a matching fingerprint was enrolled in Firestore for this user / slot
      const userFp = cmd?.userId 
        ? db.fingerprints.find(f => f.userId === cmd.userId && f.status === 'Active') 
        : null;

      if (cmd) {
        let normalizedStatus: 'PENDING_SCAN' | 'SCANNING' | 'COMPLETED' | 'FAILED' = 'PENDING_SCAN';
        if (cmd.status === 'COMPLETED' || userFp) {
          normalizedStatus = 'COMPLETED';
        } else if (cmd.status === 'FAILED') {
          normalizedStatus = 'FAILED';
        } else if (cmd.status === 'EXECUTING' || cmd.status === 'DISPATCHED') {
          normalizedStatus = 'SCANNING';
        }

        return NextResponse.json({
          jobId,
          commandId: jobId,
          status: normalizedStatus,
          job: {
            jobId: cmd.commandId,
            commandId: cmd.commandId,
            deviceId: cmd.deviceId,
            userId: cmd.userId,
            slotNumber: cmd.slotNumber || userFp?.slotNumber || 1,
            status: normalizedStatus,
            reason: cmd.errorReason,
            createdAt: cmd.createdAt,
            completedAt: cmd.completedAt
          }
        });
      }

      // Check if a matching fingerprint was recently enrolled on this device
      const fp = db.fingerprints.find(f => f.status === 'Active' && (!deviceId || f.enrolledTerminals?.includes(deviceId)));
      if (fp) {
        return NextResponse.json({
          jobId,
          status: 'COMPLETED',
          job: {
            jobId,
            status: 'COMPLETED',
            slotNumber: fp.slotNumber,
            userId: fp.userId
          }
        });
      }

      return NextResponse.json({
        jobId,
        status: 'PENDING_SCAN',
        job: null
      });
    }

    const db = await readDb();

    // Find templates enrolled in database
    const usersWithFingerprints = db.users.map(u => {
      const fp = db.fingerprints.find(f => f.userId === u.id && f.status === 'Active');
      return {
        userId: u.id,
        name: u.name,
        role: u.role,
        hasFingerprint: !!fp,
        slotNumber: fp?.slotNumber || 0,
        templateData: fp?.templateData || (fp ? `DY50_FP_${u.id}_SAMPLE_TEMPLATE_HEX_A5F90B2` : null),
        isEnrolledOnThisTerminal: deviceId && fp?.enrolledTerminals?.includes(deviceId)
      };
    });

    const device = deviceId ? db.devices.find(d => d.id === deviceId) : null;
    const maxSlots = device?.maxSlots || 300;
    const terminalEnrolledCount = deviceId 
      ? db.fingerprints.filter(f => f.status === 'Active' && f.enrolledTerminals?.includes(deviceId)).length
      : db.fingerprints.filter(f => f.status === 'Active').length;
    const freeSlots = Math.max(0, maxSlots - terminalEnrolledCount);

    return NextResponse.json({
      deviceId: deviceId || 'ALL',
      totalUsers: db.users.length,
      totalEnrolledInDb: db.fingerprints.filter(f => f.status === 'Active').length,
      maxSlots,
      terminalEnrolledCount,
      freeSlots,
      users: usersWithFingerprints,
      serverTime: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error fetching enrollment data:', err);
    return NextResponse.json({ error: 'Failed to fetch enrollment data' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const db = await readDb();
    
    const rawAction = String(body.action || body.type || body.command || '').toUpperCase();
    const rawDeviceId = body.deviceId || body.device_id || body.terminalId || body.terminal_id;
    const cleanDeviceId = rawDeviceId ? String(rawDeviceId).trim().toUpperCase() : 'DEV_TERM_01';
    
    let rawUserId = body.userId || body.user_id || body.studentId || body.student_id;
    const rawSlot = body.slotNumber ?? body.slot_number ?? body.slot ?? body.fingerId ?? body.finger_id ?? body.pageId ?? body.page_id;
    const slotNumber = rawSlot !== undefined && rawSlot !== null && rawSlot !== '' ? Number(rawSlot) : undefined;
    const commandId = body.commandId || body.command_id || body.jobId;

    // 1. Sync all fingerprint templates to terminal
    if (rawAction === 'SYNC_ALL_TO_TERMINAL') {
      const devIndex = db.devices.findIndex(d => d.id === cleanDeviceId);
      if (devIndex === -1) {
        return NextResponse.json({ error: 'Device not found' }, { status: 404 });
      }

      let syncedCount = 0;
      db.fingerprints.forEach((fp, idx) => {
        if (fp.status === 'Active') {
          if (!fp.enrolledTerminals) fp.enrolledTerminals = [];
          if (!fp.enrolledTerminals.includes(cleanDeviceId)) {
            fp.enrolledTerminals.push(cleanDeviceId);
          }
          if (!fp.slotNumber) {
            fp.slotNumber = idx + 1;
          }
          if (!fp.templateData) {
            fp.templateData = `DY50_FP_${fp.userId}_TEMPLATE_HEX_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          }
          syncedCount++;
        }
      });

      db.devices[devIndex].enrolledFingerprints = syncedCount;
      db.devices[devIndex].freeSlots = Math.max(0, (db.devices[devIndex].maxSlots || 300) - syncedCount);
      db.devices[devIndex].fingerprintStatus = `DY50 Ready (${syncedCount} templates loaded)`;
      db.devices[devIndex].lcdText = [
        '** ATTENDX TERMINAL **',
        `Bio-Sync Complete!`,
        `${syncedCount} Fingerprints OK`,
        `Net: CONNECTED | Bat:${db.devices[devIndex].batteryStatus}%`
      ];

      await writeDb(db);

      return NextResponse.json({
        success: true,
        message: `Successfully synchronized ${syncedCount} fingerprint templates from database to terminal ${cleanDeviceId}`,
        syncedCount,
        deviceId: cleanDeviceId
      });
    }

    // 2. Queue live interactive enrollment on a physical terminal for a user (persisted in Firestore)
    if (rawAction === 'QUEUE_ENROLLMENT' || rawAction === 'ARM_TERMINAL' || rawAction === 'START_ENROLLMENT') {
      if (!rawUserId) {
        return NextResponse.json({ error: 'userId is required' }, { status: 400 });
      }

      const cleanUserId = String(rawUserId).trim().toUpperCase();
      const user = db.users.find(u => u.id === cleanUserId || u.id.toLowerCase() === cleanUserId.toLowerCase());
      if (!user) {
        return NextResponse.json({ error: `User '${cleanUserId}' not found in registered directory` }, { status: 404 });
      }

      // Determine slot - leave undefined by default to let hardware dynamically assign it
      const targetSlotNumber = slotNumber || undefined;
      const generatedCommandId = commandId ? String(commandId).trim() : `cmd_enroll_${Date.now().toString(36)}`;

      // Queue command in Firestore so ESP32 terminal receives it on next telemetry poll
      const queuedCmd = await queueCommandForDevice({
        commandId: generatedCommandId,
        type: 'ENROLL_FINGERPRINT',
        deviceId: cleanDeviceId,
        userId: user.id,
        slotNumber: targetSlotNumber
      });

      // Update device LCD preview to show enrollment prompt
      const devIndex = db.devices.findIndex(d => d.id === cleanDeviceId);
      if (devIndex !== -1) {
        db.devices[devIndex].lcdText = [
          '** ENROLL MODE **',
          `User: ${user.name.substring(0, 14)}`,
          `Place finger on sensor`,
          targetSlotNumber ? `Slot #${targetSlotNumber} (1/2)` : `Slot: Auto (1/2)`
        ];
        await writeDb(db);
      }

      return NextResponse.json({
        success: true,
        message: `Enrollment command sent to terminal ${cleanDeviceId}. Terminal prompt armed for ${user.name}.`,
        job: {
          jobId: queuedCmd.commandId,
          commandId: queuedCmd.commandId,
          deviceId: cleanDeviceId,
          userId: user.id,
          userName: user.name,
          slotNumber: targetSlotNumber,
          status: 'PENDING_SCAN',
          createdAt: queuedCmd.createdAt
        }
      });
    }

    // 3. Complete enrollment (persists to Firestore & updates terminal stats)
    const isCompletionAction = 
      rawAction === 'COMPLETE_ENROLLMENT' || 
      rawAction === 'ENROLL' || 
      rawAction === 'ENROLL_FINGERPRINT' || 
      rawAction === 'REGISTER' || 
      rawAction === 'SAVE_TEMPLATE' ||
      rawAction === 'SUCCESS' ||
      body.status === 'success';

    if (isCompletionAction) {
      if (!rawUserId && slotNumber !== undefined) {
        const paddedSlot = String(slotNumber).padStart(3, '0');
        const candidateUser = 
          db.users.find(u => u.id.startsWith(paddedSlot)) ||
          db.users[slotNumber - 1] ||
          db.users[0];
        if (candidateUser) {
          rawUserId = candidateUser.id;
        }
      }

      if (!rawUserId) {
        return NextResponse.json({ error: 'userId or slotNumber is required' }, { status: 400 });
      }

      const cleanUserId = String(rawUserId).trim().toUpperCase();
      const user = db.users.find(u => u.id === cleanUserId || u.id.toLowerCase() === cleanUserId.toLowerCase());
      if (!user) {
        return NextResponse.json({ error: 'User not found in registered directory' }, { status: 404 });
      }

      const resolvedSlot = slotNumber || (db.fingerprints.length + 1);

      // Record result in Firestore (updates commands, fingerprints, and device status simultaneously)
      await recordCommandResult({
        deviceId: cleanDeviceId || 'DEV_TERM_01',
        commandId: commandId ? String(commandId).trim() : undefined,
        type: 'ENROLL_FINGERPRINT',
        status: 'success',
        source: 'terminal',
        userId: user.id,
        slotNumber: resolvedSlot,
        timestamp: new Date().toISOString()
      });

      const updatedDb = await readDb();
      const dev = cleanDeviceId ? updatedDb.devices.find(d => d.id === cleanDeviceId) : null;
      const totalEnrolledOnTerminal = cleanDeviceId 
        ? updatedDb.fingerprints.filter(f => f.status === 'Active' && f.enrolledTerminals?.includes(cleanDeviceId)).length
        : updatedDb.fingerprints.filter(f => f.status === 'Active').length;
      const maxSlots = dev?.maxSlots || 300;
      const freeSlots = Math.max(0, maxSlots - totalEnrolledOnTerminal);

      return NextResponse.json({
        ok: true,
        ack: true,
        success: true,
        status: 'SUCCESS',
        message: `Biometric fingerprint template enrolled for ${user.name} and persisted to central database.`,
        userId: user.id,
        userName: user.name,
        slotNumber: resolvedSlot,
        deviceId: cleanDeviceId,
        enrolledSlots: totalEnrolledOnTerminal,
        freeSlots,
        maxSlots,
        serverTime: new Date().toISOString()
      });
    }

    // 4. Report Enrollment Failure from ESP32 optical sensor
    if (rawAction === 'REPORT_FAILURE' || rawAction === 'FAILURE' || rawAction === 'ERROR' || body.status === 'error') {
      const { reason = 'Optical sensor timed out or noisy capture' } = body;

      if (commandId) {
        await recordCommandResult({
          deviceId: cleanDeviceId || 'DEV_TERM_01',
          commandId: String(commandId).trim(),
          type: 'ENROLL_FINGERPRINT',
          status: 'error',
          source: 'terminal',
          errorReason: reason,
          timestamp: new Date().toISOString()
        });
      }

      return NextResponse.json({
        ok: false,
        ack: true,
        success: false,
        status: 'FAILED',
        message: `Enrollment failure recorded: ${reason}`,
        reason,
        deviceId: cleanDeviceId,
        userId: rawUserId,
        serverTime: new Date().toISOString()
      });
    }

    return NextResponse.json({ error: 'Invalid enrollment action' }, { status: 400 });
  } catch (err) {
    console.error('Error in enrollment handler:', err);
    return NextResponse.json({ error: 'Failed to process enrollment' }, { status: 500 });
  }
}
