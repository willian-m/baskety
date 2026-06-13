import { vi } from "vitest";

// Mock AsyncStorage used by uiStore.native.ts so tests run in Node without a
// React Native runtime.  The mock behaves like a real in-memory store.
const store: Record<string, string> = {};

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(store[key] ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
      return Promise.resolve();
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach((k) => delete store[k]);
      return Promise.resolve();
    }),
    multiGet: vi.fn((keys: string[]) =>
      Promise.resolve(keys.map((k) => [k, store[k] ?? null] as [string, string | null])),
    ),
    multiSet: vi.fn((pairs: [string, string][]) => {
      pairs.forEach(([k, v]) => (store[k] = v));
      return Promise.resolve();
    }),
    multiRemove: vi.fn((keys: string[]) => {
      keys.forEach((k) => delete store[k]);
      return Promise.resolve();
    }),
    getAllKeys: vi.fn(() => Promise.resolve(Object.keys(store))),
    mergeItem: vi.fn(),
    flushGetRequests: vi.fn(),
  },
}));
