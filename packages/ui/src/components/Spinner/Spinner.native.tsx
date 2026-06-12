import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

export interface SpinnerProps {
  size?: "sm" | "md" | "lg";
}

const rnSizeMap: Record<string, "small" | "large"> = {
  sm: "small",
  md: "small",
  lg: "large",
};

export function Spinner({ size = "md" }: SpinnerProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={rnSizeMap[size]} color="#2563eb" accessibilityLabel="Loading" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center" },
});
