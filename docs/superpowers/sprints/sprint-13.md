# Sprint 13 — Mobile: Foundation + Auth + Navigation

**Goal:** Expo app boots, routes work, login/register screens functional against real API.

**Dependencies:** Sprint 9 (packages/core reused in mobile); Sprint 1 (apps/mobile scaffold).

| # | Task | Est. |
|---|------|------|
| 13.1 | Configure Expo Router file-based routes: `(auth)/_layout`, `(auth)/login`, `(auth)/register`, `(auth)/onboarding`, `(app)/_layout`, all app screens | 0.5d |
| 13.2 | Implement `useServerUrl` hook in `apps/mobile/shared/hooks/`: reads WiFi SSID via `@react-native-community/netinfo`; matches against network profiles; falls back to externalUrl | 1d |
| 13.3 | Wire `@baskety/core` AuthContext, HouseholdContext, API client, and TanStack QueryClient (with AsyncStorage persister) in mobile root `_layout.tsx` | 0.5d |
| 13.4 | Build Onboarding screen: external URL input with connectivity check; optional local SSID + URL for home network | 0.5d |
| 13.5 | Build Login screen: email/password form, error feedback, redirect on success | 0.5d |
| 13.6 | Build Register screen: email/name/password, validation, auto-login | 0.5d |
| 13.7 | Implement `packages/ui` native variants: Button, Badge, TextInput, Card, Avatar, Spinner, ExpiryBadge (`.native.tsx`) | 1d |

**Sprint total: 4.5d**
