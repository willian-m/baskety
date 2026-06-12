import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface NetworkProfile {
  id: string;
  label: string;
  ssids: string[];
  serverUrl: string;
}

interface UiState {
  token: string | null;
  activeHouseholdId: string | null;
  activeServerUrl: string | null;
  externalUrl: string | null;
  networkProfiles: NetworkProfile[];
  sidebarCollapsed: boolean;
  setSession: (token: string, firstHouseholdId?: string) => void;
  clearSession: () => void;
  setActiveHousehold: (id: string) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActiveServerUrl: (url: string | null) => void;
  setExternalUrl: (url: string | null) => void;
  addProfile: (profile: NetworkProfile) => void;
  updateProfile: (id: string, patch: Partial<Omit<NetworkProfile, "id">>) => void;
  removeProfile: (id: string) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      token: null,
      activeHouseholdId: null,
      activeServerUrl: null,
      externalUrl: null,
      networkProfiles: [],
      sidebarCollapsed: false,
      setSession: (token, firstHouseholdId) =>
        set({ token, activeHouseholdId: firstHouseholdId ?? null }),
      clearSession: () => set({ token: null, activeHouseholdId: null }),
      setActiveHousehold: (id) => set({ activeHouseholdId: id }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setActiveServerUrl: (url) => set({ activeServerUrl: url }),
      setExternalUrl: (url) => set({ externalUrl: url }),
      addProfile: (profile) =>
        set((s) => ({ networkProfiles: [...s.networkProfiles, profile] })),
      updateProfile: (id, patch) =>
        set((s) => ({
          networkProfiles: s.networkProfiles.map((p) =>
            p.id === id ? { ...p, ...patch } : p,
          ),
        })),
      removeProfile: (id) =>
        set((s) => ({
          networkProfiles: s.networkProfiles.filter((p) => p.id !== id),
        })),
    }),
    {
      name: "baskety-ui",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        token: state.token,
        activeHouseholdId: state.activeHouseholdId,
        externalUrl: state.externalUrl,
        networkProfiles: state.networkProfiles,
        sidebarCollapsed: state.sidebarCollapsed,
        // activeServerUrl is NOT persisted — recomputed by useServerUrl on mount
      }),
    },
  ),
);
