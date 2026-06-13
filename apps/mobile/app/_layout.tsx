import { useUiStore } from "@baskety/core";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Redirect, Stack } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";

const PRIMARY_BLUE = "#2563eb";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24,
      staleTime: 1000 * 60 * 5,
    },
  },
});

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
});

function RootNavigator() {
  const externalUrl = useUiStore((s) => s.externalUrl);
  const hasHydrated = useUiStore((s) => s._hasHydrated);

  if (!hasHydrated) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={PRIMARY_BLUE} />
      </View>
    );
  }

  if (!externalUrl) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            const key = query.queryKey;
            if (!Array.isArray(key)) return false;
            // key[2] === "lists" covers both shapes:
            //   ["inventories", id, "lists"]               → grocery lists index
            //   ["inventories", id, "lists", listId, "items"] → list items
            return key[2] === "lists";
          },
        },
      }}
    >
      <RootNavigator />
    </PersistQueryClientProvider>
  );
}
