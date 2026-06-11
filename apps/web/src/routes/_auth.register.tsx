import { createRoute } from "@tanstack/react-router";

import { RegisterPage } from "../features/auth/RegisterPage.js";

import { Route as AuthRoute } from "./_auth.js";

export const Route = createRoute({
  getParentRoute: () => AuthRoute,
  path: "/register",
  component: RegisterPage,
});
