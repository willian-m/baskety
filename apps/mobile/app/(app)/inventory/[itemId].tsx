import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  useAddBatch,
  useBatches,
  useDeleteItem,
  useInventories,
  useInventoryItem,
  useUpdateItem,
} from "@baskety/core";
import type { BatchResponse, InventoryItemResponse } from "@baskety/core";
import { Button, Card, ExpiryBadge, Spinner, TextInput } from "@baskety/ui";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function BatchRow({ batch, unit }: { batch: BatchResponse; unit: string }) {
  return (
    <Card padding={12}>
      <View style={styles.batchHeader}>
        <Text style={styles.batchQty}>
          {batch.quantity} {unit}
        </Text>
        <ExpiryBadge expiresAt={batch.expires_at} />
      </View>
      <Text style={styles.batchMeta}>
        Added: {formatDate(batch.added_at)}
      </Text>
      {batch.expires_at ? (
        <Text style={styles.batchMeta}>
          Expires: {formatDate(batch.expires_at)}
        </Text>
      ) : null}
      {batch.notes ? (
        <Text style={styles.batchNotes}>{batch.notes}</Text>
      ) : null}
    </Card>
  );
}

function AddBatchForm({
  inventoryId,
  itemId,
}: {
  inventoryId: string;
  itemId: string;
}) {
  const [quantity, setQuantity] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");
  const addBatch = useAddBatch(inventoryId, itemId);

  function handleSubmit() {
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert("Invalid quantity", "Please enter a positive number.");
      return;
    }
    const trimmedExpiry = expiresAt.trim();
    if (trimmedExpiry && !ISO_DATE_RE.test(trimmedExpiry)) {
      Alert.alert("Invalid date", "Use YYYY-MM-DD format, e.g. 2026-12-31.");
      return;
    }
    addBatch.mutate(
      {
        quantity: qty,
        expires_at: trimmedExpiry || null,
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          setQuantity("");
          setExpiresAt("");
          setNotes("");
        },
        onError: () => {
          Alert.alert("Error", "Failed to add batch.");
        },
      },
    );
  }

  return (
    <Card>
      <Text style={styles.sectionTitle}>Add Batch</Text>
      <View style={styles.formField}>
        <TextInput
          label="Quantity"
          value={quantity}
          onChange={setQuantity}
          keyboardType="numeric"
          placeholder="e.g. 2"
        />
      </View>
      <View style={styles.formField}>
        <TextInput
          label="Expiry date (ISO, optional)"
          value={expiresAt}
          onChange={setExpiresAt}
          placeholder="e.g. 2026-12-31"
          autoCapitalize="none"
        />
      </View>
      <View style={styles.formField}>
        <TextInput
          label="Notes (optional)"
          value={notes}
          onChange={setNotes}
          placeholder="e.g. organic brand"
        />
      </View>
      <Button
        label="Add Batch"
        onPress={handleSubmit}
        loading={addBatch.isPending}
      />
    </Card>
  );
}

function EditItemModal({
  visible,
  item,
  inventoryId,
  onClose,
}: {
  visible: boolean;
  item: InventoryItemResponse;
  inventoryId: string;
  onClose: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [unit, setUnit] = useState(item.unit);
  const [targetQty, setTargetQty] = useState(String(item.target_quantity));
  const [notes, setNotes] = useState(item.notes ?? "");
  const updateItem = useUpdateItem(inventoryId, item.id);

  function handleSave() {
    if (!name.trim() || !category.trim() || !unit.trim()) {
      Alert.alert("Required fields", "Name, category, and unit cannot be blank.");
      return;
    }
    const qty = parseFloat(targetQty);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert("Invalid target quantity", "Please enter a positive number.");
      return;
    }
    updateItem.mutate(
      {
        name: name.trim(),
        category: category.trim(),
        unit: unit.trim(),
        target_quantity: qty,
        notes: notes.trim() || null,
      },
      {
        onSuccess: onClose,
        onError: () => {
          Alert.alert("Error", "Failed to update item.");
        },
      },
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalSheet}
        >
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Edit Item</Text>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <View style={styles.formField}>
              <TextInput
                label="Name"
                value={name}
                onChange={setName}
                autoCapitalize="words"
              />
            </View>
            <View style={styles.formField}>
              <TextInput
                label="Category"
                value={category}
                onChange={setCategory}
                autoCapitalize="words"
              />
            </View>
            <View style={styles.formField}>
              <TextInput
                label="Unit"
                value={unit}
                onChange={setUnit}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.formField}>
              <TextInput
                label="Target quantity"
                value={targetQty}
                onChange={setTargetQty}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.formField}>
              <TextInput
                label="Notes (optional)"
                value={notes}
                onChange={setNotes}
              />
            </View>
            <Button
              label="Save"
              onPress={handleSave}
              loading={updateItem.isPending}
            />
            <View style={styles.formField}>
              <Button label="Cancel" variant="secondary" onPress={onClose} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function ItemDetailContent({
  inventoryId,
  itemId,
}: {
  inventoryId: string;
  itemId: string;
}) {
  const { data: item, isLoading: itemLoading } = useInventoryItem(
    inventoryId,
    itemId,
  );
  const { data: batches, isLoading: batchesLoading } = useBatches(
    inventoryId,
    itemId,
  );
  const deleteItem = useDeleteItem(inventoryId);
  const [editVisible, setEditVisible] = useState(false);

  if (itemLoading || batchesLoading) {
    return (
      <View style={styles.centered}>
        <Spinner />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Item not found.</Text>
      </View>
    );
  }

  function handleDelete() {
    Alert.alert(
      "Delete item",
      `Are you sure you want to delete "${item!.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteItem.mutate(item!.id, {
              onSuccess: () => router.back(),
              onError: () => Alert.alert("Error", "Failed to delete item."),
            });
          },
        },
      ],
    );
  }

  const activeBatches = (batches ?? []).filter((b) => b.emptied_at === null);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.detailContent}
    >
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backBtnLabel}>← Back</Text>
      </Pressable>
      <Card>
        <View style={styles.detailHeader}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Pressable onPress={() => setEditVisible(true)} style={styles.editBtn}>
            <Text style={styles.editBtnLabel}>Edit</Text>
          </Pressable>
        </View>
        <Text style={styles.itemMeta}>Category: {item.category}</Text>
        <Text style={styles.itemMeta}>
          Target: {item.target_quantity} {item.unit}
        </Text>
        {item.notes ? (
          <Text style={styles.itemNotes}>{item.notes}</Text>
        ) : null}
      </Card>

      <Text style={styles.sectionTitle}>
        Batches ({activeBatches.length})
      </Text>

      {activeBatches.length === 0 ? (
        <Text style={styles.emptyText}>No active batches.</Text>
      ) : (
        <FlatList
          data={activeBatches}
          keyExtractor={(b) => b.id}
          renderItem={({ item: batch }) => <BatchRow batch={batch} unit={item.unit} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          scrollEnabled={false}
        />
      )}

      <View style={styles.section}>
        <AddBatchForm inventoryId={inventoryId} itemId={itemId} />
      </View>

      <View style={styles.section}>
        <Button
          label="Delete Item"
          variant="danger"
          onPress={handleDelete}
          loading={deleteItem.isPending}
        />
      </View>

      {editVisible ? (
        <EditItemModal
          visible={editVisible}
          item={item}
          inventoryId={inventoryId}
          onClose={() => setEditVisible(false)}
        />
      ) : null}
    </ScrollView>
  );
}

export default function ItemDetailScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
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
      <ItemDetailContent inventoryId={inventoryId} itemId={itemId} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: "#f9fafb" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  detailContent: { padding: 12, gap: 12 },
  detailHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  itemName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
    marginRight: 8,
  },
  itemMeta: { fontSize: 14, color: "#4b5563", marginBottom: 4 },
  itemNotes: {
    fontSize: 14,
    color: "#6b7280",
    fontStyle: "italic",
    marginTop: 4,
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  editBtnLabel: { fontSize: 14, fontWeight: "500", color: "#374151" },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  section: { marginTop: 4 },
  batchHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  batchQty: { fontSize: 15, fontWeight: "600", color: "#111827" },
  batchMeta: { fontSize: 13, color: "#6b7280" },
  batchNotes: {
    fontSize: 13,
    color: "#6b7280",
    fontStyle: "italic",
    marginTop: 2,
  },
  formField: { marginBottom: 12 },
  separator: { height: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "85%",
    paddingTop: 12,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d1d5db",
    alignSelf: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  modalBody: { padding: 16, gap: 4 },
  backBtn: { paddingVertical: 8, paddingHorizontal: 4, marginBottom: 4 },
  backBtnLabel: { fontSize: 15, color: "#2563eb", fontWeight: "500" },
  errorText: { fontSize: 15, color: "#ef4444" },
  emptyText: { fontSize: 15, color: "#6b7280" },
});
