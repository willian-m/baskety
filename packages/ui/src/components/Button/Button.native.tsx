import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

export interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger";
}

export function Button({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = "primary",
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text style={[styles.label, styles[`${variant}Label` as keyof typeof styles]]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primary: { backgroundColor: "#2563eb" },
  secondary: { backgroundColor: "#f3f4f6", borderWidth: 1, borderColor: "#e5e7eb" },
  danger: { backgroundColor: "#ef4444" },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  label: { fontSize: 16, fontWeight: "600" },
  primaryLabel: { color: "#ffffff" },
  secondaryLabel: { color: "#111827" },
  dangerLabel: { color: "#ffffff" },
});
