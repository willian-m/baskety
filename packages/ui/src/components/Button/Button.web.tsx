import React from "react";

export interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function Button({ label, onPress, disabled = false, loading = false }: ButtonProps) {
  return (
    <button onClick={onPress} disabled={disabled || loading}>
      {loading ? "…" : label}
    </button>
  );
}
