import { useHouseholds, useLogout, useUiStore } from "@baskety/core";
import { createRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Route as RootRoute } from "./__root.js";

function HouseholdSwitcher() {
  const { data: households } = useHouseholds();
  const activeHouseholdId = useUiStore((s) => s.activeHouseholdId);
  const setActiveHousehold = useUiStore((s) => s.setActiveHousehold);
  const setActiveInventory = useUiStore((s) => s.setActiveInventory);
  const [open, setOpen] = useState(false);

  const current = households?.find((h) => h.id === activeHouseholdId) ?? households?.[0];

  if (!current) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        {current.name} ▾
      </button>
      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 w-48 rounded-md border bg-background shadow-md">
          {households?.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => {
                setActiveHousehold(h.id);
                setActiveInventory("");
                setOpen(false);
              }}
              className="block w-full px-4 py-2 text-left text-sm hover:bg-muted"
            >
              {h.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AppLayout() {
  const logout = useLogout();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
    } catch {
      // Server-side revocation may fail if the token was already invalid;
      // onSettled in useLogout still calls clearSession(), so local state is
      // always cleaned up.  We navigate to /login regardless.
    }
    await navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen">
      <nav className="border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="font-bold text-lg tracking-tight">
            Baskety
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/inventory"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              activeProps={{ className: "text-foreground font-medium" }}
            >
              Inventory
            </Link>
            <Link
              to="/grocery"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              activeProps={{ className: "text-foreground font-medium" }}
            >
              Grocery
            </Link>
            <Link
              to="/receipt"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              activeProps={{ className: "text-foreground font-medium" }}
            >
              Receipts
            </Link>
            <Link
              to="/settings"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              activeProps={{ className: "text-foreground font-medium" }}
            >
              Settings
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <HouseholdSwitcher />
          <button
            type="button"
            data-testid="logout-button"
            onClick={() => void handleLogout()}
            disabled={logout.isPending}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {logout.isPending ? "Logging out…" : "Logout"}
          </button>
        </div>
      </nav>
      <Outlet />
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  id: "_app",
  beforeLoad: () => {
    const token = useUiStore.getState().token;
    if (!token) throw redirect({ to: "/login" });
  },
  component: AppLayout,
});
