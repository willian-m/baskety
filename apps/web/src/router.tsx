import { createRouter } from "@tanstack/react-router";

import { Route as RootRoute } from "./routes/__root.js";
import { Route as AppIndexRoute } from "./routes/_app.index.js";
import { Route as AppRoute } from "./routes/_app.js";
import { Route as AuthRoute } from "./routes/_auth.js";
import { Route as LoginRoute } from "./routes/_auth.login.js";
import { Route as RegisterRoute } from "./routes/_auth.register.js";

const routeTree = RootRoute.addChildren([
  AppRoute.addChildren([AppIndexRoute]),
  AuthRoute.addChildren([LoginRoute, RegisterRoute]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
