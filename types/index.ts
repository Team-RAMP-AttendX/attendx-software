export type Role = 'Student' | 'Staff' | 'Admin';
export type AuthMode = 'fingerprint' | 'pin';
export type AttendanceStatus = 'Present' | 'Late' | 'Absent';
export type SyncStatus = 'Pending' | 'Syncing' | 'Synced' | 'Failed';
export type DeviceStatus = 'ONLINE' | 'OFFLINE';

export interface User {
  id: string; // User ID
  name: string;
  role: Role;
  status: 'Active' | 'Inactive';
  dateRegistered: string; // ISO date string
  pinHash?: string;
  totalAttendance: number;
  lateOccurrences: number;
}

export interface Fingerprint {
  id: string;
  userId: string;
  registrationDate: string;
  status: 'Active' | 'Inactive';
  slotNumber?: number;
  templateData?: string; // Hex or base64 representation of SMF V1.7 512-byte template
  enrolledTerminals?: string[]; // Terminal IDs where this template is installed
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  deviceId: string;
  date: string; // YYYY-MM-DD
  checkInTime?: string; // ISO String
  checkOutTime?: string; // ISO String
  checkInMode?: AuthMode;
  checkOutMode?: AuthMode;
  status: AttendanceStatus;
  lateDurationMinutes: number;
  syncStatus: SyncStatus;
  createdAt: string; // ISO String
}

export interface PINImage {
  id: string;
  attendanceId: string;
  userId: string;
  captureTime: string; // ISO String
  authMode: AuthMode;
  storageRef: string; // Just a mock path for the demo
}

export interface Device {
  id: string;
  name?: string;
  location?: string;
  status: DeviceStatus;
  wifiStatus: 'Connected' | 'Disconnected';
  lastSync: string; // ISO String
  pendingRecords: number;
  batteryStatus: number; // Percentage
  powerStatus: 'AC' | 'Battery';
  ipAddress?: string;
  macAddress?: string;
  firmwareVersion?: string;
  esp32Heap?: string;
  fingerprintStatus?: string;
  cameraStatus?: string;
  keypadStatus?: string;
  lcdStatus?: string;
  lcdText?: string[];
  voltage?: string;
  rssi?: number;
  enrolledFingerprints?: number;
  maxSlots?: number;
  freeSlots?: number;
  heartbeatIntervalSeconds?: number;
  pinFallbackEnabled?: boolean;
  cameraEvidenceEnabled?: boolean;
}

export interface Administrator {
  id: string;
  email: string;
  name: string;
  role: 'Master Administrator' | 'Security Officer' | 'Attendance Supervisor' | 'System Operator';
  status: 'Active' | 'Suspended';
  isMaster: boolean;
  addedAt: string;
  addedBy?: string;
  lastLoginAt?: string;
  notes?: string;
}

export interface TerminalCommand {
  commandId: string;
  type: 'ENROLL_FINGERPRINT' | 'DELETE_FINGERPRINT' | 'REBOOT' | 'CLEAR_RECORDS';
  deviceId: string;
  userId?: string;
  slotNumber?: number;
  status: 'PENDING' | 'DISPATCHED' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  dispatchedAt?: string;
  completedAt?: string;
  errorReason?: string;
}

export interface CommandResultReport {
  deviceId: string;
  commandId?: string;
  type: 'ENROLL_FINGERPRINT' | 'DELETE_FINGERPRINT';
  status: 'success' | 'error';
  source?: 'dashboard' | 'terminal';
  userId?: string;
  slotNumber?: number;
  errorReason?: string;
  timestamp: string;
}

export interface DatabaseSchema {
  users: User[];
  fingerprints: Fingerprint[];
  attendance: AttendanceRecord[];
  images: PINImage[];
  devices: Device[];
  administrators?: Administrator[];
  commands?: TerminalCommand[];
}
