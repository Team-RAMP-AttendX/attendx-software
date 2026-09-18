# AttendX

## Problem
Fingerprint recognition fails frequently. Network outages interrupt centralized synchronization.

## Solution
A resilient smart attendance system with Fingerprint primary authentication, PIN fallback (with ESP-CAM image evidence), offline local storage, and automatic synchronization.

## Features
- Fingerprint & PIN Authentication
- Duplicate Prevention & Late Tracking
- PIN Image Evidence Vault
- Offline Mode & Automatic Sync
- Central Dashboard with Analytics
- Filter-aware Excel Export

## Architecture
- **Hardware:** ESP32, SMF V1.7, ESP-CAM
- **Backend:** Next.js API Routes (Node.js)
- **Frontend:** Next.js App Router, Tailwind CSS, Lucide Icons, Recharts

## Setup
1. `npm install`
2. `npm run dev`
3. Access Dashboard at `http://localhost:3000`

## Demo Mode
The MVP includes pre-seeded demo data that demonstrates fingerprint events, PIN fallback events, late arrivals, and offline synchronization states.

## Roadmap
- Multiple Terminals
- Configurable Schedules
- Institution Management
