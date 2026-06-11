import { createRoute } from "@tanstack/react-router";

import { InventoryPage } from "../features/inventory/InventoryPage.js";

import { Route as InventoryRoute } from "./_app.inventory.js";

export const Route = createRoute({
  getParentRoute: () => InventoryRoute,
  path: "/",
  component: InventoryPage,
});
