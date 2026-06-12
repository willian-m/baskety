import React from "react";
import { StyleSheet, Text, View } from "react-native";

export type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  default: { bg: "#f3f4f6", text: "#374151" },
  success: { bg: "#dcfce7", text: "#166534" },
  warning: { bg: "#fef9c3", text: "#854d0e" },
  danger:  { bg: "#fee2e2", text: "#991b1b" },
  info:    { bg: "#cffafe", text: "#155e75" },
};

export function Badge({ label, variant = "default" }: BadgeProps) {
  const { bg, text } = variantStyles[variant];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  label: { fontSize: 12, fontWeight: "500" },
});
