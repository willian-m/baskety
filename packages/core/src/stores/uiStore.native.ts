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
  activeInventoryId: string;
  activeServerUrl: string | null;
  externalUrl: string | null;
  networkProfiles: NetworkProfile[];
  sidebarCollapsed: boolean;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
  setSession: (token: string, firstHouseholdId?: string) => void;
  clearSession: () => void;
  setActiveHousehold: (id: string) => void;
  setActiveInventory: (id: string) => void;
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
      activeInventoryId: "",
      activeServerUrl: null,
      externalUrl: null,
      networkProfiles: [],
      sidebarCollapsed: false,
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),
      setSession: (token, firstHouseholdId) =>
        set({ token, activeHouseholdId: firstHouseholdId ?? null }),
      clearSession: () => set({ token: null, activeHouseholdId: null }),
      setActiveHousehold: (id) => set({ activeHouseholdId: id, activeInventoryId: "" }),
      setActiveInventory: (id) => set({ activeInventoryId: id }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setActiveServerUrl: (url) => set({ activeServerUrl: url }),
      setExternalUrl: (url) => set({ externalUrl: url }),
      addProfile: (profile) => set((s) => ({ networkProfiles: [...s.networkProfiles, profile] })),
      updateProfile: (id, patch) =>
        set((s) => ({
          networkProfiles: s.networkProfiles.map((p) => (p.id === id ? { ...p, ...patch } : p)),
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
        activeInventoryId: state.activeInventoryId,
        externalUrl: state.externalUrl,
        networkProfiles: state.networkProfiles,
        sidebarCollapsed: state.sidebarCollapsed,
        // activeServerUrl is NOT persisted — recomputed by useServerUrl on mount
        // _hasHydrated is NOT persisted — resets to false on each boot, becomes true after rehydration
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          useUiStore.getState().setHasHydrated(true);
        } else {
          state?.setHasHydrated(true);
        }
      },
    },
  ),
);
