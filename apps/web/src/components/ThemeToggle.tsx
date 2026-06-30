import { useUiStore } from "@baskety/core";

export function ThemeToggle() {
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      title="Toggle theme"
      className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-border bg-secondary text-[15px] text-secondary-foreground hover:bg-secondary/80"
    >
      {theme === "dark" ? "☀︎" : "☾"}
    </button>
  );
}
