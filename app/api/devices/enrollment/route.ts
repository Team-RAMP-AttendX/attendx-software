import { NextResponse } from 'next/server';
import { readDb, writeDb, queueCommandForDevice } from '@/lib/db';
import { Fingerprint } from '@/types';

// In-memory active enrollment queue for ESP terminals (waiting for finger placement)
interface PendingEnrollmentJob {
  jobId: string;
  deviceId: string;
  userId: string;
  userName: string;
  slotNumber: number;
  status: 'PENDING_SCAN' | 'SCANNING' | 'COMPLETED' | 'FAILED';
  reason?: string;
  completedAt?: string;
  createdAt: string;
}

let pendingJobs: PendingEnrollmentJob[] = [];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get('deviceId')?.trim().toUpperCase();
    const jobId = searchParams.get('jobId')?.trim();

    // Direct job status lookup for UI polling
    if (jobId) {
      const foundJob = pendingJobs.find(j => j.jobId === jobId);
      return NextResponse.json({
        jobId,
        status: foundJob ? foundJob.status : 'NOT_FOUND',
        job: foundJob || null
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
        // Template data (512-byte template hex or mock packet for SMF V1.7)
        templateData: fp?.templateData || (fp ? `SMF17_FP_${u.id}_SAMPLE_TEMPLATE_HEX_A5F90B2` : null),
        isEnrolledOnThisTerminal: deviceId && fp?.enrolledTerminals?.includes(deviceId)
      };
    });

    // Check if there is a pending live enrollment job waiting on this terminal
    const terminalJob = deviceId ? pendingJobs.find(j => j.deviceId === deviceId && j.status === 'PENDING_SCAN') : null;

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
      pendingJob: terminalJob || null,
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
    const { action, deviceId, userId, templateData, slotNumber } = body;

    const cleanDeviceId = deviceId ? String(deviceId).trim().toUpperCase() : '';

    // 1. Trigger synchronization of all database fingerprint templates to an added terminal
    if (action === 'SYNC_ALL_TO_TERMINAL') {
      if (!cleanDeviceId) {
        return NextResponse.json({ error: 'deviceId is required' }, { status: 400 });
      }

      const devIndex = db.devices.findIndex(d => d.id === cleanDeviceId);
      if (devIndex === -1) {
        return NextResponse.json({ error: 'Device not found' }, { status: 404 });
      }

      let syncedCount = 0;
      // Mark all active database fingerprints as loaded onto this terminal
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
            fp.templateData = `SMF17_FP_${fp.userId}_TEMPLATE_HEX_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          }
          syncedCount++;
        }
      });

      // Update terminal metadata
      db.devices[devIndex].enrolledFingerprints = syncedCount;
      db.devices[devIndex].fingerprintStatus = `SMF V1.7 Ready (${syncedCount} templates loaded)`;
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

    // 2. Queue live interactive enrollment on a physical terminal for a user
    if (action === 'QUEUE_ENROLLMENT') {
      if (!cleanDeviceId || !userId) {
        return NextResponse.json({ error: 'deviceId and userId are required' }, { status: 400 });
      }

      const user = db.users.find(u => u.id === userId);
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Next available slot
      const existingFpSlots = db.fingerprints.map(f => f.slotNumber || 0);
      const nextSlot = (Math.max(0, ...existingFpSlots)) + 1;

      // Clean existing pending jobs for this terminal
      pendingJobs = pendingJobs.filter(j => j.deviceId !== cleanDeviceId);

      const newJob: PendingEnrollmentJob = {
        jobId: `JOB_${Date.now()}`,
        deviceId: cleanDeviceId,
        userId: user.id,
        userName: user.name,
        slotNumber: slotNumber || nextSlot,
        status: 'PENDING_SCAN',
        createdAt: new Date().toISOString()
      };

      pendingJobs.push(newJob);

      // Queue command for hardware telemetry polling (§2.1 of Contract)
      await queueCommandForDevice({
        commandId: `cmd_${Date.now().toString(36)}`,
        type: 'ENROLL_FINGERPRINT',
        deviceId: cleanDeviceId,
        userId: user.id
      });

      // Update device LCD preview to show enrollment prompt
      const devIndex = db.devices.findIndex(d => d.id === cleanDeviceId);
      if (devIndex !== -1) {
        db.devices[devIndex].lcdText = [
          '** ENROLL MODE **',
          `User: ${user.name.substring(0, 14)}`,
          `Place finger on sensor`,
          `Slot #${newJob.slotNumber} (1/2)`
        ];
        await writeDb(db);
      }

      return NextResponse.json({
        success: true,
        message: `Enrollment command sent to terminal ${cleanDeviceId}. Terminal prompt armed for ${user.name}.`,
        job: newJob
      });
    }

    // 3. Complete enrollment (sent by ESP32 terminal after reading SMF optical sensor)
    if (action === 'COMPLETE_ENROLLMENT') {
      if (!userId) {
        return NextResponse.json({ error: 'userId is required' }, { status: 400 });
      }

      const user = db.users.find(u => u.id === userId);
      if (!user) {
        return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
      }

      const now = new Date().toISOString();
      const generatedTemplate = templateData || `SMF17_FP_${userId}_ENROLLED_${Date.now().toString(16).toUpperCase()}`;
      const resolvedSlot = slotNumber || (db.fingerprints.length + 1);

      // Check if user already has a fingerprint record
      const fpIndex = db.fingerprints.findIndex(f => f.userId === userId);
      if (fpIndex !== -1) {
        db.fingerprints[fpIndex].status = 'Active';
        db.fingerprints[fpIndex].registrationDate = now;
        db.fingerprints[fpIndex].slotNumber = resolvedSlot;
        db.fingerprints[fpIndex].templateData = generatedTemplate;
        if (cleanDeviceId) {
          if (!db.fingerprints[fpIndex].enrolledTerminals) db.fingerprints[fpIndex].enrolledTerminals = [];
          if (!db.fingerprints[fpIndex].enrolledTerminals?.includes(cleanDeviceId)) {
            db.fingerprints[fpIndex].enrolledTerminals?.push(cleanDeviceId);
          }
        }
      } else {
        const newFp: Fingerprint = {
          id: `FP${String(db.fingerprints.length + 1).padStart(3, '0')}`,
          userId,
          registrationDate: now,
          status: 'Active',
          slotNumber: resolvedSlot,
          templateData: generatedTemplate,
          enrolledTerminals: cleanDeviceId ? [cleanDeviceId] : []
        };
        db.fingerprints.push(newFp);
      }

      // Update terminal status if specified
      if (cleanDeviceId) {
        const devIndex = db.devices.findIndex(d => d.id === cleanDeviceId);
        if (devIndex !== -1) {
          const totalActive = db.fingerprints.filter(f => f.status === 'Active').length;
          db.devices[devIndex].enrolledFingerprints = totalActive;
          db.devices[devIndex].lcdText = [
            '** ENROLL SUCCESS **',
            `User: ${user.name.substring(0, 14)}`,
            `Stored in Slot #${resolvedSlot}`,
            'Template Saved to DB'
          ];
        }
      }

      // Update pending job status for UI polling
      const existingJob = pendingJobs.find(j => (cleanDeviceId && j.deviceId === cleanDeviceId) || j.userId === userId);
      if (existingJob) {
        existingJob.status = 'COMPLETED';
        existingJob.completedAt = now;
      }

      await writeDb(db);

      const dev = cleanDeviceId ? db.devices.find(d => d.id === cleanDeviceId) : null;
      const totalEnrolledOnTerminal = cleanDeviceId 
        ? db.fingerprints.filter(f => f.status === 'Active' && f.enrolledTerminals?.includes(cleanDeviceId)).length
        : db.fingerprints.filter(f => f.status === 'Active').length;
      const maxSlots = dev?.maxSlots || 300;
      const freeSlots = Math.max(0, maxSlots - totalEnrolledOnTerminal);

      return NextResponse.json({
        success: true,
        status: 'SUCCESS',
        message: `Biometric fingerprint template enrolled for ${user.name} and persisted to central database.`,
        userId,
        userName: user.name,
        slotNumber: resolvedSlot,
        deviceId: cleanDeviceId,
        enrolledSlots: totalEnrolledOnTerminal,
        freeSlots,
        maxSlots
      });
    }

    // 4. Report Enrollment Failure from ESP32 optical sensor
    if (action === 'REPORT_FAILURE') {
      const { reason = 'Optical sensor timed out or finger image noisy' } = body;
      const job = cleanDeviceId ? pendingJobs.find(j => j.deviceId === cleanDeviceId) : (userId ? pendingJobs.find(j => j.userId === userId) : null);
      if (job) {
        job.status = 'FAILED';
      }

      if (cleanDeviceId) {
        const devIndex = db.devices.findIndex(d => d.id === cleanDeviceId);
        if (devIndex !== -1) {
          db.devices[devIndex].lcdText = [
            '** ENROLL FAILED **',
            'Try Again...',
            'Keep Finger Flat',
            'Timeout/Noise'
          ];
          await writeDb(db);
        }
      }

      return NextResponse.json({
        success: false,
        status: 'FAILED',
        message: `Enrollment failed reported by hardware: ${reason}`,
        reason,
        deviceId: cleanDeviceId,
        userId: userId || job?.userId
      });
    }

    return NextResponse.json({ error: 'Invalid enrollment action' }, { status: 400 });
  } catch (err) {
    console.error('Error in enrollment handler:', err);
    return NextResponse.json({ error: 'Failed to process enrollment' }, { status: 500 });
  }
}
