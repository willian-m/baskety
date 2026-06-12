import React from "react";
import { StyleSheet, TextInput as RNTextInput, View, Text } from "react-native";

export interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  secureTextEntry?: boolean;
  label?: string;
  error?: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad" | "url";
  autoComplete?: "off" | "email" | "password" | "name" | "username";
}

export function TextInput({
  value,
  onChange,
  placeholder,
  disabled = false,
  secureTextEntry = false,
  label,
  error,
  autoCapitalize = "none",
  keyboardType = "default",
  autoComplete = "off",
}: TextInputProps) {
  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <RNTextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        editable={!disabled}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        autoComplete={autoComplete}
        style={[styles.input, disabled && styles.disabled, error ? styles.inputError : null]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: "500", color: "#374151", marginBottom: 4 },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: "#ffffff",
    color: "#111827",
  },
  inputError: { borderColor: "#ef4444" },
  disabled: { backgroundColor: "#f9fafb", color: "#9ca3af" },
  error: { fontSize: 12, color: "#ef4444", marginTop: 4 },
});
