import { createRoute } from "@tanstack/react-router";

import { SharePage } from "../features/share/SharePage.js";

import { Route as RootRoute } from "./__root.js";

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: "/share/$token",
  component: SharePage,
});
