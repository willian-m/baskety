import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import React from "react";
import { createRoot } from "react-dom/client";

import { AuthProvider } from "./features/auth/AuthContext.js";
import { HouseholdProvider } from "./features/household/HouseholdContext.js";
import { router } from "./router.js";
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
