import { useHouseholds, useLogout, useUiStore } from "@baskety/core";
import { useQueryClient } from "@tanstack/react-query";
import { createRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { ThemeToggle } from "../components/ThemeToggle.js";
import { BasketLogo } from "../components/icons.js";

import { Route as RootRoute } from "./__root.js";

function HouseholdSwitcher() {
  const qc = useQueryClient();
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
        className="flex h-[34px] items-center gap-1.5 rounded-lg border border-border bg-secondary px-3.5 text-[13px] text-secondary-foreground hover:bg-secondary/80"
      >
        {current.name} <span className="text-[9px] text-muted-foreground">▾</span>
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
                void qc.invalidateQueries();
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
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 flex h-14 items-center border-b border-border bg-card px-8 shadow-soft">
        <Link to="/inventory" className="mr-9 flex flex-shrink-0 items-center gap-2.5">
          <BasketLogo />
          <span className="font-serif text-xl font-semibold tracking-tight">Baskety</span>
        </Link>
        <div className="flex h-full items-stretch">
          {[
            { to: "/inventory", label: "Inventory" },
            { to: "/grocery", label: "Grocery" },
            { to: "/receipt", label: "Receipts" },
            { to: "/settings", label: "Settings" },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center border-b-[2.5px] border-t-[2.5px] border-transparent px-4 text-sm text-secondary-foreground hover:text-foreground"
              activeProps={{ className: "border-b-primary font-semibold text-primary" }}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <HouseholdSwitcher />
          <button
            type="button"
            data-testid="logout-button"
            onClick={() => void handleLogout()}
            disabled={logout.isPending}
            className="h-[34px] rounded-lg border border-border bg-transparent px-3 text-[13px] text-muted-foreground hover:text-foreground disabled:opacity-50"
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
