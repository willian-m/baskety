import React from "react";
import { StyleSheet, View } from "react-native";

export interface CardProps {
  children: React.ReactNode;
  padding?: number;
}

export function Card({ children, padding = 16 }: CardProps) {
  return <View style={[styles.card, { padding }]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
});
