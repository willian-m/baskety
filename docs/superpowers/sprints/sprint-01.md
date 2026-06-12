# Sprint 1 — Monorepo Scaffold + Shared Packages Bootstrap

**Goal:** A working, runnable monorepo skeleton where all workspaces resolve, build, and lint cleanly. No application logic yet.

**Dependencies:** None.

| # | Task | Est. |
|---|------|------|
| 1.1 | Initialize git repo; add `.gitignore` (Go, Node, Expo, Docker, secrets) | 0.5d |
| 1.2 | Scaffold pnpm workspace root: `pnpm-workspace.yaml`, root `package.json`, shared ESLint + Prettier config | 0.5d |
| 1.3 | Configure Turborepo `turbo.json`: pipelines for `build`, `test`, `lint`, `typecheck` with correct task dependency order | 0.5d |
| 1.4 | Scaffold `packages/core`: `package.json`, TypeScript config, Zod dependency, empty barrel exports (`api/`, `queries/`, `stores/`, `validation/`) | 1d |
| 1.5 | Scaffold `packages/ui`: `package.json`, TypeScript + React Native peer deps, empty component stubs with `.web.tsx`/`.native.tsx` extension pattern | 1d |
| 1.6 | Scaffold `apps/web`: Vite + React + TypeScript + Tailwind + shadcn/ui init; confirm `pnpm dev` starts on `:5173` | 0.5d |
| 1.7 | Scaffold `apps/mobile`: `npx create-expo-app` with TypeScript template; add Expo Router; confirm Expo Go boots | 0.5d |
| 1.8 | Scaffold `baskety/` (Go module): `go.mod`, `cmd/baskety/main.go` stub, directory skeleton for all internal domain packages | 0.5d |

**Sprint total: 5d**
