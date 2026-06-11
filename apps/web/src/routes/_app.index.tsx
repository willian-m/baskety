import { createRoute, redirect } from "@tanstack/react-router";

import { Route as AppRoute } from "./_app.js";

export const Route = createRoute({
  getParentRoute: () => AppRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/inventory" });
  },
  component: () => null,
});
