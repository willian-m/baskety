import { useUiStore } from "@baskety/core";
import { createRoute, Outlet, redirect } from "@tanstack/react-router";

import { Route as RootRoute } from "./__root.js";

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  id: "_auth",
  beforeLoad: () => {
    const token = useUiStore.getState().token;
    if (token) throw redirect({ to: "/" });
  },
  component: () => (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        <Outlet />
      </div>
    </div>
  ),
});
