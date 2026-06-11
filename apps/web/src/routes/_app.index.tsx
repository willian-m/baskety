import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/")({
  component: () => (
    <div>
      <h1>Welcome to Baskety</h1>
    </div>
  ),
});
