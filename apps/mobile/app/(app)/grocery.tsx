import {
  useAutoGenerateList,
  useCreateList,
  useGroceryLists,
  useInventories,
} from "@baskety/core";
import { Badge, Button, Spinner, TextInput } from "@baskety/ui";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { GroceryListResponse } from "@baskety/core";

function statusBadgeVariant(status: string): "default" | "success" | "warning" | "info" {
  if (status === "active") return "info";
  if (status === "completed") return "success";
  if (status === "archived") return "default";
  return "default";
}

interface ListRowProps {
  item: GroceryListResponse;
  onPress: () => void;
}

function ListRow({ item, onPress }: ListRowProps) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowContent}>
        <Text style={styles.rowName}>{item.name}</Text>
        <Badge label={item.status} variant={statusBadgeVariant(item.status)} />
      </View>
    </Pressable>
  );
}

export default function GroceryScreen() {
  const { data: inventories, isLoading: invLoading } = useInventories();
  const inventoryId = inventories?.[0]?.id ?? "";

  const { data: lists, isLoading: listsLoading } = useGroceryLists(inventoryId);

  const createList = useCreateList(inventoryId);
  const autoGenerate = useAutoGenerateList(inventoryId);

  const [modalVisible, setModalVisible] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [createError, setCreateError] = useState("");

  if (invLoading) {
    return (
      <View style={styles.centered}>
        <Spinner />
      </View>
    );
  }

  const pinned = (lists ?? []).filter((l) => l.pinned_at != null);
  const active = (lists ?? []).filter((l) => l.status === "active" && l.pinned_at == null);

  const sections = [
    { title: "Pinned", data: pinned },
    { title: "Active", data: active },
  ].filter((s) => s.data.length > 0);

  async function handleCreate() {
    if (!newListName.trim()) {
      setCreateError("Name is required.");
      return;
    }
    try {
      await createList.mutateAsync({ name: newListName.trim() });
      setNewListName("");
      setCreateError("");
      setModalVisible(false);
    } catch {
      setCreateError("Failed to create list. Try again.");
    }
  }

  async function handleAutoGenerate() {
    try {
      await autoGenerate.mutateAsync();
    } catch {
      // silently ignore — UX can be improved with a toast later
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Grocery Lists</Text>
        <Pressable
          style={styles.autoGenBtn}
          onPress={handleAutoGenerate}
          disabled={autoGenerate.isPending}
        >
          {autoGenerate.isPending ? (
            <Spinner size="sm" />
          ) : (
            <Text style={styles.autoGenText}>Auto-generate</Text>
          )}
        </Pressable>
      </View>

      {listsLoading ? (
        <View style={styles.centered}>
          <Spinner />
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No lists yet. Create one or auto-generate.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <ListRow
              item={item}
              onPress={() => router.push(`/(app)/grocery/${item.id}`)}
            />
          )}
          contentContainerStyle={styles.listContent}
        />
      )}

      <Pressable style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabLabel}>+ New List</Text>
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>New Grocery List</Text>
            <TextInput
              label="List name"
              value={newListName}
              onChange={setNewListName}
              placeholder="e.g. Weekly shop"
              autoCapitalize="sentences"
              error={createError}
            />
            <View style={styles.modalActions}>
              <Button
                label="Cancel"
                variant="secondary"
                onPress={() => {
                  setModalVisible(false);
                  setNewListName("");
                  setCreateError("");
                }}
              />
              <Button
                label="Create"
                onPress={handleCreate}
                loading={createList.isPending}
              />
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  autoGenBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#eff6ff",
    borderRadius: 8,
    minWidth: 40,
    alignItems: "center",
  },
  autoGenText: { fontSize: 14, fontWeight: "600", color: "#2563eb" },
  listContent: { paddingBottom: 100 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  row: {
    backgroundColor: "#ffffff",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
  },
  rowContent: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowName: { fontSize: 16, fontWeight: "500", color: "#111827", flex: 1, marginRight: 8 },
  emptyText: { fontSize: 15, color: "#6b7280", textAlign: "center", paddingHorizontal: 32 },
  fab: {
    position: "absolute",
    bottom: 32,
    right: 24,
    backgroundColor: "#2563eb",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  fabLabel: { fontSize: 15, fontWeight: "700", color: "#ffffff" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  modalActions: { flexDirection: "row", gap: 12 },
});
