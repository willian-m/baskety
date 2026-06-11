import { createRouter } from "@tanstack/react-router";

import { Route as RootRoute } from "./routes/__root.js";
import { Route as GroceryListRoute } from "./routes/_app.grocery.$listId.js";
import { Route as GroceryIndexRoute } from "./routes/_app.grocery.index.js";
import { Route as GroceryRoute } from "./routes/_app.grocery.js";
import { Route as AppIndexRoute } from "./routes/_app.index.js";
import { Route as InventoryItemRoute } from "./routes/_app.inventory.$itemId.js";
import { Route as InventoryIndexRoute } from "./routes/_app.inventory.index.js";
import { Route as InventoryRoute } from "./routes/_app.inventory.js";
import { Route as AppRoute } from "./routes/_app.js";
import { Route as SettingsIndexRoute } from "./routes/_app.settings.index.js";
import { Route as SettingsRoute } from "./routes/_app.settings.js";
import { Route as AuthRoute } from "./routes/_auth.js";
import { Route as LoginRoute } from "./routes/_auth.login.js";
import { Route as RegisterRoute } from "./routes/_auth.register.js";

const routeTree = RootRoute.addChildren([
  AppRoute.addChildren([
    AppIndexRoute,
    GroceryRoute.addChildren([GroceryIndexRoute, GroceryListRoute]),
    InventoryRoute.addChildren([InventoryIndexRoute, InventoryItemRoute]),
    SettingsRoute.addChildren([SettingsIndexRoute]),
  ]),
  AuthRoute.addChildren([LoginRoute, RegisterRoute]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
