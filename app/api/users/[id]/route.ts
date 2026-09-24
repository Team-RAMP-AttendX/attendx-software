import { NextResponse } from 'next/server';
import { readDb, writeDb, deleteUserDoc, saveUserDoc } from '@/lib/db';

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const body = await req.json();
    const db = await readDb();
    
    const userIndex = db.users.findIndex((u: any) => u.id === params.id);
    
    if (userIndex === -1) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Handle specific fields
    if (body.name !== undefined) db.users[userIndex].name = body.name.trim();
    if (body.role !== undefined) db.users[userIndex].role = body.role;
    if (body.status !== undefined) db.users[userIndex].status = body.status;
    
    // PIN management
    if (body.pin !== undefined) {
      if (body.pin) {
        db.users[userIndex].pinHash = `auth_hash_${body.pin}`;
      } else {
        delete db.users[userIndex].pinHash;
      }
    }
    
    // Fingerprint management
    if (body.enrollFingerprint) {
      // Remove any existing active fingerprint for this user
      db.fingerprints = db.fingerprints.filter(fp => fp.userId !== params.id);
      const nextSlot = (Math.max(0, ...db.fingerprints.map(f => f.slotNumber || 0))) + 1;
      db.fingerprints.push({
        id: `FP_${String(Date.now()).slice(-6)}`,
        userId: params.id,
        registrationDate: new Date().toISOString(),
        status: 'Active',
        slotNumber: nextSlot,
        templateData: `DY50_FP_${params.id}_TEMPLATE_HEX_${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        enrolledTerminals: body.terminalId ? [body.terminalId] : db.devices.map(d => d.id)
      });
    } else if (body.removeFingerprint) {
      db.fingerprints = db.fingerprints.filter(fp => fp.userId !== params.id);
    }
    
    await writeDb(db);
    await saveUserDoc(db.users[userIndex]);
    
    return NextResponse.json({
      ...db.users[userIndex],
      hasFingerprint: db.fingerprints.some(fp => fp.userId === params.id && fp.status === 'Active'),
      hasPin: !!db.users[userIndex].pinHash
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const db = await readDb();
    
    const userIndex = db.users.findIndex((u: any) => u.id === params.id);
    if (userIndex === -1) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Permanently remove user and fingerprints from Firestore
    await deleteUserDoc(params.id);
    
    // Also remove from in-memory cache and commit
    db.users.splice(userIndex, 1);
    db.fingerprints = db.fingerprints.filter(fp => fp.userId !== params.id);
    
    await writeDb(db);
    
    return NextResponse.json({ success: true, message: `User ${params.id} deleted successfully` });
  } catch (err) {
    console.error('Delete user error:', err);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
