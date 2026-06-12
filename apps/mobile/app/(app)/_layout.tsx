import { useUiStore } from "@baskety/core";
import { Redirect, Stack } from "expo-router";
import React from "react";

export default function AppLayout() {
  const token = useUiStore((s) => s.token);
  if (!token) {
    return <Redirect href="/(auth)/login" />;
  }
  return <Stack />;
}
