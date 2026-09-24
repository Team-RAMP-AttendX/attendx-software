import { NextRequest, NextResponse } from 'next/server';
import { 
  getAdministrators, 
  saveAdministratorDoc, 
  deleteAdministratorDoc, 
  DEFAULT_MASTER_ADMIN,
  MASTER_ADMIN_EMAIL 
} from '@/lib/db';
import { Administrator } from '@/types';

export async function GET() {
  try {
    const administrators = await getAdministrators();
    return NextResponse.json({
      success: true,
      administrators,
      masterEmail: MASTER_ADMIN_EMAIL
    });
  } catch (err: unknown) {
    console.error('Failed to load administrators:', err);
    return NextResponse.json(
      { success: false, message: 'Failed to retrieve administrators.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, role, notes, addedBy } = body;

    const normalizedEmail = (email || '').trim().toLowerCase();
    const cleanName = (name || '').trim();

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return NextResponse.json(
        { success: false, message: 'A valid email address is required.' },
        { status: 400 }
      );
    }

    if (!cleanName) {
      return NextResponse.json(
        { success: false, message: 'Administrator full name is required.' },
        { status: 400 }
      );
    }

    const currentAdmins = await getAdministrators();
    const alreadyExists = currentAdmins.some(a => a.email.toLowerCase() === normalizedEmail);

    if (alreadyExists) {
      return NextResponse.json(
        { success: false, message: `Administrator with email "${normalizedEmail}" already exists.` },
        { status: 409 }
      );
    }

    const newAdmin: Administrator = {
      id: `admin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email: normalizedEmail,
      name: cleanName,
      role: role || 'Security Officer',
      status: 'Active',
      isMaster: normalizedEmail === MASTER_ADMIN_EMAIL.toLowerCase(),
      addedAt: new Date().toISOString(),
      addedBy: addedBy || 'Master Administrator',
      notes: notes || ''
    };

    await saveAdministratorDoc(newAdmin);

    return NextResponse.json({
      success: true,
      message: `Administrator "${cleanName}" (${normalizedEmail}) has been successfully provisioned. They can now request OTPs.`,
      administrator: newAdmin
    });
  } catch (err: unknown) {
    console.error('Error creating administrator:', err);
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Failed to create administrator.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, role, notes } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: 'Admin ID is required.' }, { status: 400 });
    }

    const admins = await getAdministrators();
    const target = admins.find(a => a.id === id);

    if (!target) {
      return NextResponse.json({ success: false, message: 'Administrator not found.' }, { status: 404 });
    }

    if (target.isMaster && status === 'Suspended') {
      return NextResponse.json(
        { success: false, message: 'The Master Administrator account cannot be suspended.' },
        { status: 400 }
      );
    }

    const updated: Administrator = {
      ...target,
      status: status || target.status,
      role: role || target.role,
      notes: notes !== undefined ? notes : target.notes
    };

    await saveAdministratorDoc(updated);

    return NextResponse.json({
      success: true,
      message: `Administrator updated successfully.`,
      administrator: updated
    });
  } catch (err: unknown) {
    console.error('Error updating administrator:', err);
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Failed to update administrator.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'Admin ID is required.' }, { status: 400 });
    }

    const admins = await getAdministrators();
    const target = admins.find(a => a.id === id);

    if (!target) {
      return NextResponse.json({ success: false, message: 'Administrator not found.' }, { status: 404 });
    }

    if (target.isMaster || target.email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()) {
      return NextResponse.json(
        { success: false, message: 'The Master Administrator account cannot be deleted.' },
        { status: 403 }
      );
    }

    await deleteAdministratorDoc(id);

    return NextResponse.json({
      success: true,
      message: `Administrator "${target.name}" (${target.email}) has been removed. They can no longer receive OTPs.`
    });
  } catch (err: unknown) {
    console.error('Error deleting administrator:', err);
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Failed to delete administrator.' },
      { status: 500 }
    );
  }
}
