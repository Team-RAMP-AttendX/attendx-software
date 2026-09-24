# Hardware Integration Contract

## Overview
This document defines the API contract between the AttendX physical terminal (ESP32 with DY50 Optical Fingerprint Sensor and ESP-CAM) and the Backend API.

## Endpoints

### 1. Check-In (Fingerprint)
`POST /api/v1/attendance/check-in`
```json
{
  "deviceId": "DEV_TERM_01",
  "userId": "USR001",
  "authenticationMode": "fingerprint",
  "timestamp": "2026-09-17T08:42:00Z"
}
```

### 2. Check-In (PIN Fallback)
`POST /api/v1/attendance/check-in`
```json
{
  "deviceId": "DEV_TERM_01",
  "userId": "USR003",
  "authenticationMode": "pin",
  "timestamp": "2026-09-17T09:17:00Z",
  "imageReference": "ESP-CAM_IMG_982374.jpg"
}
```

## Offline Synchronization
When the terminal loses Wi-Fi, it queues these JSON payloads in local NVRAM/SD storage. Upon connection restore, it iterates through the queue and POSTs to `/api/v1/sync`.
