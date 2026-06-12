import React from "react";
import { Badge } from "../Badge/Badge.native";

export interface ExpiryBadgeProps {
  expiresAt: string | null;
}

export function ExpiryBadge({ expiresAt }: ExpiryBadgeProps) {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return <Badge label="Expired" variant="danger" />;
  if (days <= 7) return <Badge label={days === 0 ? "Expiring today" : `Expiring in ${days}d`} variant="warning" />;
  return null;
}
