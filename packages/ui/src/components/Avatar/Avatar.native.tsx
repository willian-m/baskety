import React from "react";
import { StyleSheet, Text, View } from "react-native";

export interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
}

const sizeMap = { sm: 28, md: 36, lg: 48 };
const fontMap = { sm: 11, md: 14, lg: 18 };

export function Avatar({ name, size = "md" }: AvatarProps) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  const dim = sizeMap[size];
  return (
    <View style={[styles.circle, { width: dim, height: dim, borderRadius: dim / 2 }]}>
      <Text style={[styles.text, { fontSize: fontMap[size] }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center" },
  text: { color: "#ffffff", fontWeight: "600" },
});
