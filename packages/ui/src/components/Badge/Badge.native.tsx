import { Text } from "react-native";

export type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

export function Badge({ label }: BadgeProps) {
  return <Text>{label}</Text>;
}
