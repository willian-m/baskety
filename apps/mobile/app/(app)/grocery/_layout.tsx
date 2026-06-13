import { Stack } from "expo-router";
import React from "react";

export default function GroceryLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: "Lists",
      }}
    />
  );
}
