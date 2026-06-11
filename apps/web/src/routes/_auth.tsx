import { useUiStore } from "@baskety/core";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth")({
  beforeLoad: () => {
    const token = useUiStore.getState().token;
    if (token) throw redirect({ to: "/" });
  },
  component: () => (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        <Outlet />
      </div>
    </div>
  ),
});
