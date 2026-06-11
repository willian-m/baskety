import { Text } from "react-native";

export interface ExpiryBadgeProps {
  expiresAt: string | null;
}

export function ExpiryBadge({ expiresAt }: ExpiryBadgeProps) {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return <Text>Expired</Text>;
  if (days <= 7) return <Text>Expiring in {days}d</Text>;
  return null;
}
