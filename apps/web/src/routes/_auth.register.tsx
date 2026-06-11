import { createFileRoute } from "@tanstack/react-router";

import { RegisterPage } from "../features/auth/RegisterPage.js";

export const Route = createFileRoute("/_auth/register")({
  component: RegisterPage,
});
