import {
  useGroceryItems,
  useGroceryList,
  useInventories,
  useUpdateListItem,
} from "@baskety/core";
import { Badge, Spinner } from "@baskety/ui";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { GroceryItemResponse } from "@baskety/core";

type FilterTab = "all" | "pending" | "bought" | "skipped";

const TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "bought", label: "Bought" },
  { key: "skipped", label: "Skipped" },
];

function statusVariant(status: string): "default" | "success" | "warning" | "info" {
  if (status === "bought") return "success";
  if (status === "skipped") return "warning";
  if (status === "pending") return "info";
  return "default";
}

interface SwipeableItemProps {
  item: GroceryItemResponse;
  onToggle: () => void;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}

function SwipeableItem({ item, onToggle, onSwipeLeft, onSwipeRight }: SwipeableItemProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const THRESHOLD = 60;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 8 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderMove: (_, gs) => {
        translateX.setValue(gs.dx);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > THRESHOLD) {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
          onSwipeRight();
        } else if (gs.dx < -THRESHOLD) {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
          onSwipeLeft();
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  return (
    <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
      <Pressable style={styles.itemRow} onPress={onToggle}>
        <View style={styles.itemMain}>
          <Text
            style={[
              styles.itemName,
              item.status === "bought" && styles.itemNameBought,
              item.status === "skipped" && styles.itemNameSkipped,
            ]}
          >
            {item.name}
          </Text>
          <Text style={styles.itemQty}>
            {item.quantity} {item.unit}
          </Text>
        </View>
        <Badge label={item.status} variant={statusVariant(item.status)} />
      </Pressable>
    </Animated.View>
  );
}

export default function GroceryListDetailScreen() {
  const { listId } = useLocalSearchParams<{ listId: string }>();
  const navigation = useNavigation();

  const { data: inventories, isLoading: invLoading } = useInventories();
  const inventoryId = inventories?.[0]?.id ?? "";

  const { data: list } = useGroceryList(inventoryId, listId ?? "");
  const { data: items, isLoading: itemsLoading } = useGroceryItems(inventoryId, listId ?? "");
  const updateItem = useUpdateListItem(inventoryId, listId ?? "");

  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  useEffect(() => {
    if (list?.name) {
      navigation.setOptions({
        title: list.name,
        headerRight: () => (
          <Pressable
            onPress={() => router.push(`/(app)/grocery/${listId}/trip`)}
            style={styles.headerBtn}
          >
            <Text style={styles.headerBtnText}>Start Trip</Text>
          </Pressable>
        ),
      });
    }
  }, [list?.name, listId, navigation]);

  if (invLoading || itemsLoading) {
    return (
      <View style={styles.centered}>
        <Spinner />
      </View>
    );
  }

  const allItems = items ?? [];
  const filtered =
    activeTab === "all" ? allItems : allItems.filter((i) => i.status === activeTab);

  async function handleToggle(item: GroceryItemResponse) {
    const next = item.status === "bought" ? "pending" : "bought";
    try {
      await updateItem.mutateAsync({ itemId: item.id, status: next });
    } catch {
      // ignore
    }
  }

  async function handleSwipeRight(item: GroceryItemResponse) {
    try {
      await updateItem.mutateAsync({ itemId: item.id, status: "bought" });
    } catch {
      // ignore
    }
  }

  async function handleSwipeLeft(item: GroceryItemResponse) {
    try {
      await updateItem.mutateAsync({ itemId: item.id, status: "skipped" });
    } catch {
      // ignore
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No items in this view.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {filtered.map((item) => (
            <SwipeableItem
              key={item.id}
              item={item}
              onToggle={() => handleToggle(item)}
              onSwipeRight={() => handleSwipeRight(item)}
              onSwipeLeft={() => handleSwipeLeft(item)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: "#2563eb" },
  tabLabel: { fontSize: 14, fontWeight: "500", color: "#6b7280" },
  tabLabelActive: { color: "#2563eb" },
  listContent: { paddingVertical: 8, paddingHorizontal: 16 },
  itemRow: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemMain: { flex: 1, marginRight: 12 },
  itemName: { fontSize: 16, fontWeight: "500", color: "#111827", marginBottom: 2 },
  itemNameBought: { textDecorationLine: "line-through", color: "#9ca3af" },
  itemNameSkipped: { color: "#9ca3af" },
  itemQty: { fontSize: 13, color: "#6b7280" },
  emptyText: { fontSize: 15, color: "#6b7280" },
  headerBtn: { marginRight: 8 },
  headerBtnText: { fontSize: 15, fontWeight: "600", color: "#2563eb" },
});
