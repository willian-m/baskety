import { createRoute } from "@tanstack/react-router";

import { LoginPage } from "../features/auth/LoginPage.js";

import { Route as AuthRoute } from "./_auth.js";

export const Route = createRoute({
  getParentRoute: () => AuthRoute,
  path: "/login",
  component: LoginPage,
});
