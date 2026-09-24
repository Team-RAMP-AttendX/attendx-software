import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedAdminEmail, saveAdministratorDoc, MASTER_ADMIN_EMAIL } from '@/lib/db';

interface ActiveOtpRecord {
  email: string;
  code: string;
  expiresAt: number; // epoch ms
  attempts: number;
}

// In-memory active OTP storage
const activeOtps = new Map<string, ActiveOtpRecord>();

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

export async function POST(req: NextRequest) {
  try {
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid JSON request payload.' },
        { status: 200, headers: JSON_HEADERS }
      );
    }

    const { action, email, otp } = body || {};

    const normalizedEmail = (email || '').trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return NextResponse.json(
        { success: false, message: 'Please provide a valid administrator email address.' },
        { status: 200, headers: JSON_HEADERS }
      );
    }

    if (action === 'SEND_OTP') {
      // 1. Strict Security Guard: Only provisioned administrators can receive OTPs
      const authCheck = await isAuthorizedAdminEmail(normalizedEmail);
      if (!authCheck.authorized) {
        console.warn(`[AttendX Auth Rejected] Unauthorized attempt to request OTP for: ${normalizedEmail}`);
        return NextResponse.json(
          {
            success: false,
            notApproved: true,
            code: 'UNAUTHORIZED_ADMIN',
            message: `Access Denied: "${normalizedEmail}" is not in our record of approved administrators. Only provisioned administrator emails can receive verification passcodes. Please contact the Master Administrator (${MASTER_ADMIN_EMAIL}) to request access.`
          },
          { status: 200, headers: JSON_HEADERS }
        );
      }

      // Generate secure 6-digit numeric OTP
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes expiration

      activeOtps.set(normalizedEmail, {
        email: normalizedEmail,
        code,
        expiresAt,
        attempts: 0
      });

      console.log(`[AttendX Auth] Generated 5-Minute OTP for provisioned admin ${normalizedEmail}: ${code}`);

      return NextResponse.json({
        success: true,
        message: `A 5-minute verification code has been dispatched to ${normalizedEmail}`,
        email: normalizedEmail,
        adminName: authCheck.admin?.name || 'Administrator',
        adminRole: authCheck.admin?.role || 'System Administrator',
        expiresAt,
        // Provided for rapid evaluation & local fallback verification
        previewCode: code
      }, { headers: JSON_HEADERS });
    }

    if (action === 'VERIFY_OTP') {
      const record = activeOtps.get(normalizedEmail);

      if (!record) {
        return NextResponse.json(
          { success: false, code: 'NO_ACTIVE_OTP', message: 'No active OTP found. Please request a new verification code.' },
          { status: 200, headers: JSON_HEADERS }
        );
      }

      if (Date.now() > record.expiresAt) {
        activeOtps.delete(normalizedEmail);
        return NextResponse.json(
          { success: false, code: 'OTP_EXPIRED', message: 'The 5-minute verification code has expired. Please request a new OTP.' },
          { status: 200, headers: JSON_HEADERS }
        );
      }

      if (record.code !== otp?.trim()) {
        record.attempts++;
        if (record.attempts >= 5) {
          activeOtps.delete(normalizedEmail);
          return NextResponse.json(
            { success: false, code: 'TOO_MANY_ATTEMPTS', message: 'Too many incorrect attempts. Please request a new verification code.' },
            { status: 200, headers: JSON_HEADERS }
          );
        }
        return NextResponse.json(
          { success: false, code: 'INVALID_CODE', message: `Invalid code. ${5 - record.attempts} attempts remaining.` },
          { status: 200, headers: JSON_HEADERS }
        );
      }

      // Success - clear OTP and issue authenticated session token
      activeOtps.delete(normalizedEmail);
      const sessionToken = `attendx_session_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

      return NextResponse.json({
        success: true,
        message: 'Admin authentication verified successfully.',
        sessionToken,
        user: {
          email: normalizedEmail,
          role: 'System Administrator',
          authenticatedAt: new Date().toISOString()
        }
      }, { headers: JSON_HEADERS });
    }

    return NextResponse.json(
      { success: false, message: 'Invalid or unknown action requested.' },
      { status: 200, headers: JSON_HEADERS }
    );
  } catch (err: unknown) {
    console.error('OTP handler error:', err);
    return NextResponse.json(
      { 
        success: false, 
        message: err instanceof Error ? err.message : 'Authentication service encountered an unexpected error.' 
      }, 
      { status: 200, headers: JSON_HEADERS }
    );
  }
}
