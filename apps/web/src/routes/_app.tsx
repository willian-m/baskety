import { useUiStore } from "@baskety/core";
import { createRoute, Outlet, redirect } from "@tanstack/react-router";

import { Route as RootRoute } from "./__root.js";

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  id: "_app",
  beforeLoad: () => {
    const token = useUiStore.getState().token;
    if (!token) throw redirect({ to: "/login" });
  },
  component: () => <Outlet />,
});
