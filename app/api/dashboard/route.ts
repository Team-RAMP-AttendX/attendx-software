import { NextResponse } from 'next/server';
import { readDb } from '@/lib/db';

export async function GET() {
  try {
    const db = await readDb();
    
    const today = new Date().toISOString().split('T')[0];
    
    const totalUsers = db.users.length;
    const totalStudents = db.users.filter(u => u.role === 'Student').length;
    const totalStaff = db.users.filter(u => u.role === 'Staff').length;
    
    const todaysAttendance = db.attendance.filter(a => a.date === today);
    const presentToday = todaysAttendance.length;
    const absentToday = totalUsers - presentToday;
    
    const lateToday = todaysAttendance.filter(a => a.status === 'Late').length;
    const onTimeToday = presentToday - lateToday;
    
    const currentlyPresent = todaysAttendance.filter(a => !a.checkOutTime).length;
    const checkedOutToday = todaysAttendance.filter(a => !!a.checkOutTime).length;

    const fpAttendance = todaysAttendance.filter(a => a.checkInMode === 'fingerprint').length;
    const pinAttendance = todaysAttendance.filter(a => a.checkInMode === 'pin').length;

    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const presentCount = db.attendance.filter(a => a.date === dateStr).length;
      trend.push({ name: dayName, present: presentCount });
    }

    return NextResponse.json({
      metrics: {
        totalUsers,
        totalStudents,
        totalStaff,
        presentToday,
        absentToday,
        lateToday,
        onTimeToday,
        currentlyPresent,
        checkedOutToday,
      },
      analytics: {
        fingerprint: fpAttendance,
        pin: pinAttendance,
        attendanceRate: totalUsers ? Math.round((presentToday / totalUsers) * 100) : 0,
        lateRate: presentToday ? Math.round((lateToday / presentToday) * 100) : 0,
      },
      trend
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
