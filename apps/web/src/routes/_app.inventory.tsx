import { createRoute, Outlet } from "@tanstack/react-router";

import { Route as AppRoute } from "./_app.js";

export const Route = createRoute({
  getParentRoute: () => AppRoute,
  path: "/inventory",
  component: () => <Outlet />,
});
