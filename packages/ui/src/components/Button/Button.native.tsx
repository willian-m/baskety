import React from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";

export interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function Button({ label, onPress, disabled = false, loading = false }: ButtonProps) {
  return (
    <Pressable onPress={onPress} disabled={disabled || loading}>
      {loading ? <ActivityIndicator /> : <Text>{label}</Text>}
    </Pressable>
  );
}
