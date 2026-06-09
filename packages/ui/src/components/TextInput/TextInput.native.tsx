import React from "react";
import { TextInput as RNTextInput } from "react-native";

export interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function TextInput({ value, onChange, placeholder, disabled = false }: TextInputProps) {
  return (
    <RNTextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      editable={!disabled}
    />
  );
}
