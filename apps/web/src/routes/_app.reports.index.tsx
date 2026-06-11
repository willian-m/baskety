import { createRoute } from "@tanstack/react-router";

import { ReportsPage } from "../features/reports/ReportsPage.js";

import { Route as ReportsRoute } from "./_app.reports.js";

export const Route = createRoute({
  getParentRoute: () => ReportsRoute,
  path: "/",
  component: ReportsPage,
});
