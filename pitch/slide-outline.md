# Pitch Deck Outline

## Slide 1 — Title
**ATTENDX**
Smart Attendance Management System
Reliable attendance.
Even when fingerprint fails.
Even when the network goes down.

## Slide 2 — Problem
Fingerprint recognition can fail.
Attendance can become difficult to record.
Network outages can interrupt centralized synchronization.
Administrators need clear attendance visibility.

## Slide 3 — The Solution
Fingerprint + PIN fallback + ESP-CAM evidence + Offline storage + Automatic synchronization + Central dashboard.

## Slide 4 — How It Works
Authenticate -> Validate -> Record -> Capture evidence (if PIN) -> Store locally (if offline) -> Synchronize -> Dashboard

## Slide 5 — Hardware
* ESP32
* DY50 Fingerprint Sensor
* 4×4 Keypad
* 20×4 LCD
* ESP-CAM
* Backup Power

## Slide 6 — Software Architecture
Hardware -> Firmware -> API -> Backend -> Database -> Dashboard
Offline -> Local Storage -> Wi-Fi Recovery -> Sync

## Slide 7 — Innovation
* Fingerprint-first authentication
* PIN fallback with image evidence
* Offline resilience and sync
* Centralized monitoring

## Slide 8 — Dashboard
Real-time attendance, late tracking, fingerprint vs PIN, device status, synchronization.

## Slide 9 — Impact
Reliable attendance capture, reduced dependence on fingerprint recognition, evidence for PIN-based attendance, resilience during network interruptions.

## Slide 10 — Roadmap
Multiple terminals, institution management, advanced analytics, configurable schedules.

## Slide 11 — Live Demo
Fingerprint -> PIN fallback -> Image evidence -> Late detection -> Offline mode -> Automatic sync -> Dashboard.

## Slide 12 — Closing
AttendX is designed to make attendance capture more reliable, observable, and resilient.
