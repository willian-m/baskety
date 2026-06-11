import { useCreateHousehold, useCreateInventory, useUiStore } from "@baskety/core";
import { useState } from "react";

export function SetupWizard() {
  const [step, setStep] = useState<"household" | "inventory">("household");
  const [householdName, setHouseholdName] = useState("My Household");
  const [inventoryName, setInventoryName] = useState("My Pantry");
  const setActiveHousehold = useUiStore((s) => s.setActiveHousehold);
  const createHousehold = useCreateHousehold();
  const createInventory = useCreateInventory();

  const handleCreateHousehold = async () => {
    const h = await createHousehold.mutateAsync({ name: householdName });
    setActiveHousehold(h.id);
    setStep("inventory");
  };

  const handleCreateInventory = async () => {
    await createInventory.mutateAsync({ name: inventoryName });
    // queries will refetch automatically via invalidation
  };

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h2 className="text-xl font-bold tracking-tight">Welcome to Baskety</h2>
          <p className="text-sm text-muted-foreground">
            {step === "household"
              ? "First, create a household to share with your family."
              : "Now create your first inventory."}
          </p>
        </div>

        {step === "household" ? (
          <div className="space-y-3">
            <input
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              placeholder="Household name"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="button"
              onClick={() => void handleCreateHousehold()}
              disabled={!householdName.trim() || createHousehold.isPending}
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {createHousehold.isPending ? "Creating…" : "Create household"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              value={inventoryName}
              onChange={(e) => setInventoryName(e.target.value)}
              placeholder="Inventory name"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="button"
              onClick={() => void handleCreateInventory()}
              disabled={!inventoryName.trim() || createInventory.isPending}
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {createInventory.isPending ? "Creating…" : "Create inventory"}
            </button>
          </div>
        )}

        <div className="flex justify-center gap-2">
          {(["household", "inventory"] as const).map((s) => (
            <div
              key={s}
              className={`h-2 w-2 rounded-full ${step === s ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
