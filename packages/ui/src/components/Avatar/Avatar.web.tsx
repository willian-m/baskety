import React from "react";

export interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
}

export function Avatar({ name, size = "md" }: AvatarProps) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  const sizeClass = {
    sm: "h-7 w-7 text-xs",
    md: "h-9 w-9 text-sm",
    lg: "h-12 w-12 text-base",
  }[size];
  return (
    <div
      className={`inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground font-medium ${sizeClass}`}
    >
      {initials}
    </div>
  );
}
