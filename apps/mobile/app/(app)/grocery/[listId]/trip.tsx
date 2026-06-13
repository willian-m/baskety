import {
  useCompleteList,
  useGroceryItems,
  useInventories,
  useUpdateListItem,
} from "@baskety/core";
import { Button, Spinner } from "@baskety/ui";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import React, { useEffect } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { GroceryItemResponse } from "@baskety/core";

export default function ShoppingTripScreen() {
  const { listId } = useLocalSearchParams<{ listId: string }>();
  const navigation = useNavigation();

  const { data: inventories, isLoading: invLoading } = useInventories();
  const inventoryId = inventories?.[0]?.id ?? "";

  const { data: items, isLoading: itemsLoading } = useGroceryItems(inventoryId, listId ?? "");
  const updateItem = useUpdateListItem(inventoryId, listId ?? "");
  const completeList = useCompleteList(inventoryId, listId ?? "");

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  if (invLoading || itemsLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Spinner size="lg" />
        </View>
      </SafeAreaView>
    );
  }

  const allItems = items ?? [];
  const boughtCount = allItems.filter((i) => i.status === "bought").length;
  const totalCount = allItems.length;
  const pendingCount = allItems.filter((i) => i.status === "pending").length;
  const progress = totalCount > 0 ? boughtCount / totalCount : 0;

  async function handleToggle(item: GroceryItemResponse) {
    const next = item.status === "bought" ? "pending" : "bought";
    try {
      await updateItem.mutateAsync({ itemId: item.id, status: next });
    } catch {
      // ignore
    }
  }

  function handleCompleteTrip() {
    if (pendingCount > 0) {
      Alert.alert(
        "Complete Trip?",
        `${pendingCount} item${pendingCount === 1 ? "" : "s"} still pending. Completing will mark this list as done.`,
        [
          { text: "Keep Shopping", style: "cancel" },
          {
            text: "Complete",
            style: "destructive",
            onPress: () => {
              completeList
                .mutateAsync()
                .then(() => router.back())
                .catch(() => {
                  // ignore
                });
            },
          },
        ],
      );
    } else {
      completeList
        .mutateAsync()
        .then(() => router.back())
        .catch(() => {
          // ignore
        });
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.progressSection}>
        <Text style={styles.progressLabel}>
          {boughtCount} of {totalCount} items
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.listContent}>
        {allItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No items in this list.</Text>
          </View>
        ) : (
          allItems.map((item) => {
            const isBought = item.status === "bought";
            return (
              <Pressable
                key={item.id}
                style={[styles.itemRow, isBought && styles.itemRowBought]}
                onPress={() => handleToggle(item)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isBought }}
                accessibilityLabel={`${item.name}, ${item.quantity} ${item.unit}`}
              >
                <View style={styles.checkIcon}>
                  <Text style={[styles.checkText, isBought && styles.checkTextDone]}>
                    {isBought ? "✓" : "□"}
                  </Text>
                </View>
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemName, isBought && styles.itemNameDone]}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemQty}>
                    {item.quantity} {item.unit}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Complete Trip"
          onPress={handleCompleteTrip}
          loading={completeList.isPending}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111827" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  progressSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9ca3af",
    marginBottom: 8,
    textAlign: "center",
  },
  progressTrack: {
    height: 8,
    backgroundColor: "#374151",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#22c55e",
    borderRadius: 4,
  },
  listContent: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 32 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 48 },
  emptyText: { fontSize: 15, color: "#6b7280" },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 20,
    marginBottom: 10,
    minHeight: 72,
  },
  itemRowBought: { backgroundColor: "#14532d" },
  checkIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  checkText: { fontSize: 28, color: "#6b7280" },
  checkTextDone: { color: "#22c55e" },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 20, fontWeight: "600", color: "#f9fafb", marginBottom: 2 },
  itemNameDone: { color: "#6b7280", textDecorationLine: "line-through" },
  itemQty: { fontSize: 15, color: "#9ca3af" },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#374151",
  },
});
