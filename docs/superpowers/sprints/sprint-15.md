# Sprint 15 — Mobile: Receipt Scanning + Offline + Network Switching

**Goal:** Camera-based receipt scanning, full review flow on mobile, and offline grocery list fully verified.

**Dependencies:** Sprint 14; Sprint 6 (receipt API).

| # | Task | Est. |
|---|------|------|
| 15.1 | Implement `useCamera` hook: wraps expo-camera (viewfinder) + expo-image-picker (gallery); returns URI + requestPermission | 0.5d |
| 15.2 | Build Scan tab home screen: camera capture button, gallery picker fallback, recent scans list with status | 0.5d |
| 15.3 | Implement upload flow: compress image, POST as FormData (no Content-Type override), navigate to status screen | 0.5d |
| 15.4 | Build scan status screen: animated progress states (uploading/OCR/LLM/pending_review); auto-navigates on pending_review | 0.5d |
| 15.5 | Build receipt review screen (full-screen, tab bar hidden): scrollable list of parsed items; accept/reject/correct inline; confirm and commit | 2d |
| 15.6 | Implement `useOfflineSync`: listens to NetInfo connectivity; calls `queryClient.resumePausedMutations()` on reconnect | 0.5d |
| 15.7 | Verify offline grocery list round-trip: go offline → check items → reconnect → mutations replay; fix any AsyncStorage edge cases | 0.5d |

**Sprint total: 5d**
