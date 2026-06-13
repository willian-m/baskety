import React, { useMemo, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { useInventories, useInventoryItems, useUpdateItem } from "@baskety/core";
import { Card, ExpiryBadge, Spinner } from "@baskety/ui";
import type { InventoryItemResponse } from "@baskety/core";

function CategoryChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

type ItemRowProps = {
  item: InventoryItemResponse;
  inventoryId: string;
  editingItemId: string | null;
  onStartEdit: (id: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
};

function ItemRow({
  item,
  inventoryId,
  editingItemId,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
}: ItemRowProps) {
  const swipeableRef = useRef<Swipeable>(null);
  const updateItem = useUpdateItem(inventoryId, item.id);

  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [unit, setUnit] = useState(item.unit);
  const [targetQty, setTargetQty] = useState(String(item.target_quantity));
  const [saveError, setSaveError] = useState<string | null>(null);

  const isEditing = editingItemId === item.id;

  const handleStartEdit = () => {
    // Reset local form state to current item values each time we enter edit
    setName(item.name);
    setCategory(item.category);
    setUnit(item.unit);
    setTargetQty(String(item.target_quantity));
    swipeableRef.current?.close();
    onStartEdit(item.id);
  };

  const handleSave = async () => {
    setSaveError(null);
    try {
      await updateItem.mutateAsync({
        name,
        category,
        unit,
        target_quantity: parseFloat(targetQty) || 0,
      });
      onSaveEdit();
    } catch {
      setSaveError("Save failed. Please try again.");
    }
  };

  const renderRightActions = () => (
    <Pressable style={styles.swipeRightAction} onPress={handleStartEdit}>
      <Text style={styles.swipeActionText}>Edit</Text>
    </Pressable>
  );

  if (isEditing) {
    return (
      <Card>
        <View style={styles.editForm}>
          <TextInput
            style={styles.editInput}
            value={name}
            onChangeText={setName}
            placeholder="Name"
            placeholderTextColor="#9ca3af"
          />
          <TextInput
            style={styles.editInput}
            value={category}
            onChangeText={setCategory}
            placeholder="Category"
            placeholderTextColor="#9ca3af"
          />
          <TextInput
            style={styles.editInput}
            value={unit}
            onChangeText={setUnit}
            placeholder="Unit"
            placeholderTextColor="#9ca3af"
          />
          <TextInput
            style={styles.editInput}
            value={targetQty}
            onChangeText={setTargetQty}
            placeholder="Target quantity"
            placeholderTextColor="#9ca3af"
            keyboardType="numeric"
          />
          <View style={styles.editActions}>
            <Pressable
              style={[styles.saveButton, updateItem.isPending && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={updateItem.isPending}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </Pressable>
            <Pressable style={styles.cancelButton} onPress={onCancelEdit}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
          {saveError && <Text style={styles.saveErrorText}>{saveError}</Text>}
        </View>
      </Card>
    );
  }

  return (
    <Swipeable ref={swipeableRef} renderRightActions={renderRightActions}>
      <Pressable
        onPress={() => router.push(`/inventory/${item.id}`)}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        <Card>
          <View style={styles.itemHeader}>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.name}
            </Text>
            <ExpiryBadge expiresAt={null} />
          </View>
          <Text style={styles.itemCategory}>{item.category}</Text>
          <Text style={styles.itemStored}>
            Stored: {item.stored_quantity} {item.unit}
          </Text>
          <Text style={styles.itemTarget}>
            Target: {item.target_quantity} {item.unit}
          </Text>
        </Card>
      </Pressable>
    </Swipeable>
  );
}

function InventoryListContent({ inventoryId }: { inventoryId: string }) {
  const { data: items, isLoading, isError } = useInventoryItems(inventoryId);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const categories = useMemo(() => {
    if (!items) return ["All"];
    const unique = Array.from(new Set(items.map((i) => i.category)));
    return ["All", ...unique];
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    return items.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeCategory === "All" || item.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [items, search, activeCategory]);

  const handleStartEdit = (id: string) => setEditingItemId(id);
  const handleSaveEdit = () => setEditingItemId(null);
  const handleCancelEdit = () => setEditingItemId(null);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <Spinner />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load inventory items.</Text>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <View style={styles.searchBar}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search items..."
          placeholderTextColor="#9ca3af"
          style={styles.searchInput}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {categories.map((cat) => (
          <CategoryChip
            key={cat}
            label={cat}
            selected={activeCategory === cat}
            onPress={() => setActiveCategory(cat)}
          />
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ItemRow
            item={item}
            inventoryId={inventoryId}
            editingItemId={editingItemId}
            onStartEdit={handleStartEdit}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={handleCancelEdit}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No items found.</Text>
          </View>
        }
      />
    </View>
  );
}

export default function InventoryScreen() {
  const { data: inventories, isLoading } = useInventories();
  const inventoryId = inventories?.[0]?.id ?? "";

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <Spinner />
      </View>
    );
  }

  if (!inventoryId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No inventory found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Inventory</Text>
      </View>
      <InventoryListContent inventoryId={inventoryId} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: "#f9fafb" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  title: { fontSize: 24, fontWeight: "700", color: "#111827" },
  searchBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#f9fafb",
  },
  chipRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  chipSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  chipLabel: { fontSize: 13, fontWeight: "500", color: "#374151" },
  chipLabelSelected: { color: "#ffffff" },
  listContent: { padding: 12, gap: 8 },
  separator: { height: 8 },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
    marginRight: 8,
  },
  itemCategory: { fontSize: 13, color: "#6b7280", marginBottom: 2 },
  itemStored: { fontSize: 13, color: "#6b7280", marginBottom: 2 },
  itemTarget: { fontSize: 13, color: "#6b7280" },
  pressed: { opacity: 0.85 },
  errorText: { fontSize: 15, color: "#ef4444" },
  emptyText: { fontSize: 15, color: "#6b7280" },
  swipeRightAction: {
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    borderRadius: 12,
  },
  swipeActionText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  editForm: { gap: 8 },
  editInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#f9fafb",
  },
  editActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  saveButton: {
    flex: 1,
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  saveButtonText: { color: "#fff", fontWeight: "600" },
  cancelButton: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButtonText: { color: "#374151", fontWeight: "600" },
  saveErrorText: { color: "#ef4444", fontSize: 12, marginTop: 4 },
});
