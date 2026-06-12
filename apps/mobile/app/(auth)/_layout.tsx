import { useUiStore } from "@baskety/core";
import { Redirect, Stack } from "expo-router";
import React from "react";

export default function AuthLayout() {
  const token = useUiStore((s) => s.token);
  if (token) {
    return <Redirect href="/(app)/" />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
