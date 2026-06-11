import { createRoute } from "@tanstack/react-router";

import { GroceryPage } from "../features/grocery/GroceryPage.js";

import { Route as GroceryRoute } from "./_app.grocery.js";

export const Route = createRoute({
  getParentRoute: () => GroceryRoute,
  path: "/",
  component: GroceryPage,
});
