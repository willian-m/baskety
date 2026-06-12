import { useLogout, useUiStore } from "@baskety/core";
import { createRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";

import { Route as RootRoute } from "./__root.js";

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
        <button
          type="button"
          data-testid="logout-button"
          onClick={() => void handleLogout()}
          disabled={logout.isPending}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {logout.isPending ? "Logging out…" : "Logout"}
        </button>
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
