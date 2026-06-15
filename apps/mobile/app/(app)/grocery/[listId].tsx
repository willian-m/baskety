import {
  useDeleteListItem,
  useGroceryItems,
  useGroceryList,
  useInventories,
  useRenameList,
  useUpdateListItem,
} from "@baskety/core";
import type { GroceryItemResponse } from "@baskety/core";
import { Badge, Spinner } from "@baskety/ui";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

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
  selectMode: boolean;
  selected: boolean;
  onToggle: () => void;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onLongPress: () => void;
  onSelectToggle: () => void;
}

function SwipeableItem({
  item,
  selectMode,
  selected,
  onToggle,
  onSwipeLeft,
  onSwipeRight,
  onLongPress,
  onSelectToggle,
}: SwipeableItemProps) {
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

  const rowContent = (
    <View style={[styles.itemRow, selectMode && selected && styles.itemRowSelected]}>
      {selectMode && <Text style={styles.checkbox}>{selected ? "☑" : "☐"}</Text>}
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
    </View>
  );

  // In select mode, disable swipe gestures so taps reliably toggle selection.
  if (selectMode) {
    return (
      <TouchableOpacity
        onPress={onSelectToggle}
        onLongPress={onLongPress}
        accessibilityRole="checkbox"
        accessibilityLabel={item.name}
        accessibilityState={{ checked: selected }}
      >
        {rowContent}
      </TouchableOpacity>
    );
  }

  return (
    <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
      <TouchableOpacity onPress={onToggle} onLongPress={onLongPress} accessibilityLabel={item.name}>
        {rowContent}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function GroceryListDetailScreen() {
  const { listId } = useLocalSearchParams<{ listId: string }>();
  const navigation = useNavigation();

  const { data: inventories, isLoading: invLoading } = useInventories();
  const inventoryId = inventories?.[0]?.id ?? "";

  const { data: list, isLoading: listLoading } = useGroceryList(inventoryId, listId ?? "");
  const { data: items, isLoading: itemsLoading } = useGroceryItems(inventoryId, listId ?? "");
  const updateItem = useUpdateListItem(inventoryId, listId ?? "");
  const renameList = useRenameList(inventoryId, listId ?? "");
  const deleteItem = useDeleteListItem(inventoryId, listId ?? "");

  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  // Rename modal state
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameText, setRenameText] = useState(list?.name ?? "");

  // Multi-select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Keep the rename text input in sync when the list loads/changes.
  useEffect(() => {
    setRenameText(list?.name ?? "");
  }, [list?.name]);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds([]);
  }, []);

  const handleToggle = useCallback(
    async (item: GroceryItemResponse) => {
      const next = item.status === "bought" ? "pending" : "bought";
      try {
        await updateItem.mutateAsync({ itemId: item.id, status: next });
      } catch {
        // ignore
      }
    },
    [updateItem],
  );

  const handleSwipeRight = useCallback(
    async (item: GroceryItemResponse) => {
      try {
        await updateItem.mutateAsync({ itemId: item.id, status: "bought" });
      } catch {
        // ignore
      }
    },
    [updateItem],
  );

  const handleSwipeLeft = useCallback(
    async (item: GroceryItemResponse) => {
      try {
        await updateItem.mutateAsync({ itemId: item.id, status: "skipped" });
      } catch {
        // ignore
      }
    },
    [updateItem],
  );

  function startSelect(id: string) {
    setSelectMode(true);
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleConfirmRename() {
    const name = renameText.trim();
    if (!name) {
      setRenameVisible(false);
      return;
    }
    try {
      await renameList.mutateAsync(name);
    } catch {
      // ignore
    }
    setRenameVisible(false);
  }

  async function handleDeleteSelected() {
    const ids = [...selectedIds];
    setIsDeleting(true);
    try {
      await Promise.all(ids.map((id) => deleteItem.mutateAsync(id)));
    } catch {
      // individual errors surfaced via TanStack Query error state
    } finally {
      setIsDeleting(false);
      exitSelectMode();
    }
  }

  useEffect(() => {
    navigation.setOptions({
      title: list?.name ?? "List",
      headerRight: () =>
        selectMode ? (
          <Pressable onPress={exitSelectMode} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>Cancel</Text>
          </Pressable>
        ) : (
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => setRenameVisible(true)}
              style={styles.headerIconBtn}
              accessibilityLabel="Rename list"
              accessibilityRole="button"
            >
              <Text style={styles.headerIcon}>✏️</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push(`/(app)/grocery/${listId}/trip`)}
              style={styles.headerBtn}
              accessibilityRole="button"
            >
              <Text style={styles.headerBtnText}>Start Trip</Text>
            </Pressable>
          </View>
        ),
    });
  }, [exitSelectMode, list?.name, listId, navigation, selectMode]);

  if (invLoading || listLoading || itemsLoading) {
    return (
      <View style={styles.centered}>
        <Spinner />
      </View>
    );
  }

  const allItems = items ?? [];
  const filtered = activeTab === "all" ? allItems : allItems.filter((i) => i.status === activeTab);

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab.key }}
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
              selectMode={selectMode}
              selected={selectedIds.includes(item.id)}
              onToggle={() => handleToggle(item)}
              onSwipeRight={() => handleSwipeRight(item)}
              onSwipeLeft={() => handleSwipeLeft(item)}
              onLongPress={() => (selectMode ? toggleSelected(item.id) : startSelect(item.id))}
              onSelectToggle={() => toggleSelected(item.id)}
            />
          ))}
        </ScrollView>
      )}

      {selectMode && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.deleteBtn, selectedIds.length === 0 && styles.deleteBtnDisabled]}
            disabled={selectedIds.length === 0 || isDeleting}
            accessibilityLabel="Delete selected items"
            accessibilityState={{ disabled: selectedIds.length === 0 || isDeleting }}
            onPress={() => void handleDeleteSelected()}
          >
            <Text style={styles.deleteBtnText}>
              {isDeleting ? "Deleting…" : `Delete selected (${selectedIds.length})`}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal
        visible={renameVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setRenameVisible(false);
          setRenameText(list?.name ?? "");
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rename list</Text>
            <TextInput
              style={styles.modalInput}
              value={renameText}
              onChangeText={setRenameText}
              placeholder="List name"
              accessibilityLabel="List name"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => void handleConfirmRename()}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => {
                  setRenameVisible(false);
                  setRenameText(list?.name ?? "");
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.modalConfirmBtn,
                  (!renameText.trim() || renameList.isPending) && styles.modalConfirmDisabled,
                ]}
                disabled={!renameText.trim() || renameList.isPending}
                onPress={() => void handleConfirmRename()}
              >
                <Text style={styles.modalConfirmText}>
                  {renameList.isPending ? "Saving…" : "Confirm"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  itemRowSelected: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  checkbox: { fontSize: 20, marginRight: 12, color: "#2563eb" },
  emptyText: { fontSize: 15, color: "#6b7280" },
  headerActions: { flexDirection: "row", alignItems: "center" },
  headerIconBtn: { marginRight: 12, paddingHorizontal: 4 },
  headerIcon: { fontSize: 18 },
  headerBtn: { marginRight: 8 },
  headerBtnText: { fontSize: 15, fontWeight: "600", color: "#2563eb" },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  deleteBtn: {
    backgroundColor: "#dc2626",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  deleteBtnDisabled: { backgroundColor: "#fca5a5" },
  deleteBtnText: { color: "#ffffff", fontSize: 15, fontWeight: "600" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 32,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 16 },
  modalInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#111827",
    marginBottom: 20,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8 },
  modalCancelBtn: { backgroundColor: "#f3f4f6" },
  modalCancelText: { fontSize: 15, fontWeight: "600", color: "#374151" },
  modalConfirmBtn: { backgroundColor: "#2563eb" },
  modalConfirmDisabled: { backgroundColor: "#93c5fd" },
  modalConfirmText: { fontSize: 15, fontWeight: "600", color: "#ffffff" },
});
