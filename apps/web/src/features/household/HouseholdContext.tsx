import { useUiStore } from "@baskety/core";
import { createContext, useContext, type ReactNode } from "react";

interface HouseholdContextValue {
  activeHouseholdId: string | null;
  setActiveHousehold: (id: string) => void;
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const activeHouseholdId = useUiStore((s) => s.activeHouseholdId);
  const setActiveHousehold = useUiStore((s) => s.setActiveHousehold);
  return (
    <HouseholdContext.Provider value={{ activeHouseholdId, setActiveHousehold }}>
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error("useHousehold must be used within HouseholdProvider");
  return ctx;
}
