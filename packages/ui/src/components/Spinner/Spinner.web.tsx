import React from "react";

export interface SpinnerProps {
  size?: "sm" | "md" | "lg";
}

export function Spinner({ size = "md" }: SpinnerProps) {
  const sizeClass = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  }[size];
  return (
    <div
      className={`animate-spin rounded-full border-2 border-muted border-t-primary ${sizeClass}`}
      role="status"
      aria-label="Loading"
    />
  );
}
