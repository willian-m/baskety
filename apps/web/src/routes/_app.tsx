import { useUiStore } from "@baskety/core";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app")({
  beforeLoad: () => {
    const token = useUiStore.getState().token;
    if (!token) throw redirect({ to: "/login" });
  },
  component: () => <Outlet />,
});
