import { useUiStore } from "@baskety/core";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";

function Root() {
  const theme = useUiStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  return <Outlet />;
}

export const Route = createRootRoute({
  component: Root,
});
