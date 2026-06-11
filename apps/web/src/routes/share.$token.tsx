import { createFileRoute } from "@tanstack/react-router";

import { SharePage } from "../features/share/SharePage.js";

export const Route = createFileRoute("/share/$token")({
  component: SharePage,
});
