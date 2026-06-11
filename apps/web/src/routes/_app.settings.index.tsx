import { createRoute } from "@tanstack/react-router";

import { SettingsPage } from "../features/settings/SettingsPage.js";

import { Route as SettingsRoute } from "./_app.settings.js";

export const Route = createRoute({
  getParentRoute: () => SettingsRoute,
  path: "/",
  component: SettingsPage,
});
