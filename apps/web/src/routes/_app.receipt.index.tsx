import { createRoute } from "@tanstack/react-router";

import { ReceiptPage } from "../features/receipt/ReceiptPage.js";

import { Route as ReceiptRoute } from "./_app.receipt.js";

export const Route = createRoute({
  getParentRoute: () => ReceiptRoute,
  path: "/",
  component: ReceiptPage,
});
