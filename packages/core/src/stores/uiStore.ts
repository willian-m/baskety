import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  token: string | null;
  activeHouseholdId: string | null;
  activeServerUrl: string | null;
  sidebarCollapsed: boolean;
  setSession: (token: string, firstHouseholdId?: string) => void;
  clearSession: () => void;
  setActiveHousehold: (id: string) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActiveServerUrl: (url: string | null) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      token: null,
      activeHouseholdId: null,
      activeServerUrl: null,
      sidebarCollapsed: false,
      setSession: (token, firstHouseholdId) =>
        set({ token, activeHouseholdId: firstHouseholdId ?? null }),
      clearSession: () => set({ token: null, activeHouseholdId: null }),
      setActiveHousehold: (id) => set({ activeHouseholdId: id }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setActiveServerUrl: (url) => set({ activeServerUrl: url }),
    }),
    { name: "baskety-ui" },
  ),
);
