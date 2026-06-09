import React from "react";
import { Pressable, Text } from "react-native";

export interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export function Button({ label, onPress, disabled = false }: ButtonProps) {
  return (
    <Pressable onPress={onPress} disabled={disabled}>
      <Text>{label}</Text>
    </Pressable>
  );
}
