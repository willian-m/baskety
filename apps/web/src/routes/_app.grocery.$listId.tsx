import { createRoute } from "@tanstack/react-router";

import { GroceryListPage } from "../features/grocery/GroceryListPage.js";

import { Route as GroceryRoute } from "./_app.grocery.js";

export const Route = createRoute({
  getParentRoute: () => GroceryRoute,
  path: "/$listId",
  component: GroceryListPage,
});
