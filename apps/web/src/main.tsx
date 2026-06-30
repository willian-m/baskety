import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import React from "react";
import { createRoot } from "react-dom/client";

import { AuthProvider } from "./features/auth/AuthContext.js";
import { HouseholdProvider } from "./features/household/HouseholdContext.js";
import { router } from "./router.js";
// Self-hosted fonts (OFL 1.1) — see README attribution.
import "@fontsource/dm-sans/300.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/lora/400.css";
import "@fontsource/lora/500.css";
import "@fontsource/lora/600.css";
import "@fontsource/lora/400-italic.css";
import "./styles/globals.css";

const queryClient = new QueryClient();

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <HouseholdProvider>
        <RouterProvider router={router} />
      </HouseholdProvider>
    </AuthProvider>
  </QueryClientProvider>,
);
