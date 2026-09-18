import type {Metadata} from 'next';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopNav } from '@/components/layout/TopNav';

export const metadata: Metadata = {
  title: 'AttendX | Smart Attendance Management',
  description: 'Reliable attendance system with Fingerprint and PIN fallback.',
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

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className="h-full bg-gray-50">
      <body className="h-full flex" suppressHydrationWarning>
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopNav />
          <main className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
