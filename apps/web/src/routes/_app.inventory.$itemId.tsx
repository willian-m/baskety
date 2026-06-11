import { createRoute } from "@tanstack/react-router";

import { ItemDetailPage } from "../features/inventory/ItemDetailPage.js";

import { Route as InventoryRoute } from "./_app.inventory.js";

export const Route = createRoute({
  getParentRoute: () => InventoryRoute,
  path: "/$itemId",
  component: ItemDetailPage,
});
