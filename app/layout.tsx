import type { Metadata } from 'next';
import './globals.css';
import AppShell from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'AttendX | Smart Biometric Attendance Management',
  description: 'Reliable attendance system with ESP32-CAM, DY50 optical fingerprint, and PIN fallback.',
  openGraph: {
    title: 'AttendX',
    description: 'Smart Attendance Management System.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AttendX',
    description: 'Smart Attendance Management System.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full bg-slate-50">
      <body className="h-full flex antialiased" suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
