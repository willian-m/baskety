import { createRoute } from "@tanstack/react-router";

import { ReceiptReviewPage } from "../features/receipt/ReceiptReviewPage.js";

import { Route as ReceiptRoute } from "./_app.receipt.js";

export const Route = createRoute({
  getParentRoute: () => ReceiptRoute,
  path: "/$scanId/review",
  component: ReceiptReviewPage,
});
