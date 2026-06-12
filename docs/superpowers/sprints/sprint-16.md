# Sprint 16 — Mobile: Testing + EAS Build Pipeline

**Goal:** Mobile test suite green. EAS Build produces a signed APK installable on a real device.

**Dependencies:** Sprint 15.

| # | Task | Est. |
|---|------|------|
| 16.1 | Set up Jest + RNTL + MSW for mobile: configure jest preset, MSW server with handlers, mock react-native-community/netinfo | 0.5d |
| 16.2 | RNTL tests — auth screens: login/register form validation and error states | 0.5d |
| 16.3 | RNTL tests — inventory screens: list rendering, item detail, add batch | 0.5d |
| 16.4 | RNTL tests — grocery screens: item check-off, offline persistence mock | 0.5d |
| 16.5 | RNTL tests — receipt review screen: accept/reject/correct/commit flow | 0.5d |
| 16.6 | Configure `eas.json`: development, preview, production profiles; configure signing keystore | 0.5d |
| 16.7 | Run EAS Build `--platform android --profile production`; install and smoke test APK on a real Android device | 0.5d |

**Sprint total: 3.5d**
