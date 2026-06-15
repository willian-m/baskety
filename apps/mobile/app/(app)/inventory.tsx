import {
  useAddBatch,
  useBatches,
  useCreateItem,
  useInventories,
  useInventoryItem,
  useInventoryItems,
  useUpdateItem,
} from "@baskety/core";
import type { BatchResponse, InventoryItemResponse } from "@baskety/core";
import { Button, Card, ExpiryBadge, Spinner, TextInput } from "@baskety/ui";
import React, { useMemo, useRef, useState } from "react";
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
  TextInput as RNTextInput,
  View,
} from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

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
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

function BatchRow({ batch, unit }: { batch: BatchResponse; unit: string }) {
  return (
    <Card padding={12}>
      <View style={styles.batchHeader}>
        <Text style={styles.batchQty}>
          {batch.quantity} {unit}
        </Text>
        <ExpiryBadge expiresAt={batch.expires_at} />
      </View>
      <Text style={styles.batchMeta}>Added: {formatDate(batch.added_at)}</Text>
      {batch.expires_at ? (
        <Text style={styles.batchMeta}>Expires: {formatDate(batch.expires_at)}</Text>
      ) : null}
      {batch.notes ? <Text style={styles.batchNotes}>{batch.notes}</Text> : null}
    </Card>
  );
}

function AddBatchForm({ inventoryId, itemId }: { inventoryId: string; itemId: string }) {
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
      <Button label="Add Batch" onPress={handleSubmit} loading={addBatch.isPending} />
    </Card>
  );
}

function EditItemModal({
  visible,
  item,
  inventoryId,
  initialName,
  onClose,
}: {
  visible: boolean;
  item?: InventoryItemResponse;
  inventoryId: string;
  initialName?: string;
  onClose: () => void;
}) {
  const isCreate = !item;
  const [name, setName] = useState(item?.name ?? initialName ?? "");
  const [category, setCategory] = useState(item?.category ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "");
  const [targetQty, setTargetQty] = useState(item ? String(item.target_quantity) : "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const updateItem = useUpdateItem(inventoryId, item?.id ?? "");
  const createItem = useCreateItem(inventoryId);
  const isPending = isCreate ? createItem.isPending : updateItem.isPending;

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
    const body = {
      name: name.trim(),
      category: category.trim(),
      unit: unit.trim(),
      target_quantity: qty,
      notes: notes.trim() || null,
    };
    if (isCreate) {
      createItem.mutate(body, {
        onSuccess: onClose,
        onError: () => Alert.alert("Error", "Failed to create item."),
      });
    } else {
      updateItem.mutate(body, {
        onSuccess: onClose,
        onError: () => Alert.alert("Error", "Failed to update item."),
      });
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalSheet}
        >
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{isCreate ? "New Item" : "Edit Item"}</Text>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <View style={styles.formField}>
              <TextInput label="Name" value={name} onChange={setName} autoCapitalize="words" />
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
              <TextInput label="Unit" value={unit} onChange={setUnit} autoCapitalize="none" />
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
              <TextInput label="Notes (optional)" value={notes} onChange={setNotes} />
            </View>
            <Button label={isCreate ? "Create" : "Save"} onPress={handleSave} loading={isPending} />
            <View style={styles.formField}>
              <Button label="Cancel" variant="secondary" onPress={onClose} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function BatchSheetModal({
  inventoryId,
  itemId,
  onClose,
}: {
  inventoryId: string;
  itemId: string;
  onClose: () => void;
}) {
  const { data: item, isLoading: itemLoading } = useInventoryItem(inventoryId, itemId);
  const { data: batches, isLoading: batchesLoading } = useBatches(inventoryId, itemId);
  const [editVisible, setEditVisible] = useState(false);

  const isLoading = itemLoading || batchesLoading;
  const activeBatches = (batches ?? []).filter((b) => !b.emptied_at);

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel="Close"
          accessibilityRole="button"
        />
        <View style={styles.modalSheet}>
          <View style={styles.sheetTopRow}>
            <View style={styles.modalHandle} />
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={8}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <Text style={styles.closeBtnLabel}>✕</Text>
            </Pressable>
          </View>

          {isLoading ? (
            <View style={styles.sheetLoading}>
              <Spinner />
            </View>
          ) : !item ? (
            <View style={styles.sheetLoading}>
              <Text style={styles.errorText}>Item not found.</Text>
            </View>
          ) : (
            <>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetItemName}>{item.name}</Text>
                <Text style={styles.sheetItemCategory}>{item.category}</Text>
              </View>
              <ScrollView contentContainerStyle={styles.sheetBody}>
                <Text style={styles.sectionTitle}>Batches ({activeBatches.length})</Text>
                {activeBatches.length === 0 ? (
                  <Text style={styles.emptyText}>No active batches.</Text>
                ) : (
                  activeBatches.map((batch) => (
                    <View key={batch.id} style={styles.batchSpacer}>
                      <BatchRow batch={batch} unit={item.unit} />
                    </View>
                  ))
                )}

                <View style={styles.section}>
                  <AddBatchForm inventoryId={inventoryId} itemId={itemId} />
                </View>

                <View style={styles.section}>
                  <Button
                    label="Edit item"
                    variant="secondary"
                    onPress={() => setEditVisible(true)}
                  />
                </View>
              </ScrollView>

              {editVisible ? (
                <EditItemModal
                  key={item.id}
                  visible={editVisible}
                  item={item}
                  inventoryId={inventoryId}
                  onClose={() => setEditVisible(false)}
                />
              ) : null}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

type ItemRowProps = {
  item: InventoryItemResponse;
  inventoryId: string;
  editingItemId: string | null;
  onOpen: (id: string) => void;
  onStartEdit: (id: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
};

function ItemRow({
  item,
  inventoryId,
  editingItemId,
  onOpen,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
}: ItemRowProps) {
  const swipeableRef = useRef<InstanceType<typeof Swipeable>>(null);
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
    const qty = parseFloat(targetQty);
    if (isNaN(qty) || qty <= 0) {
      setSaveError("Target quantity must be a positive number.");
      return;
    }
    try {
      await updateItem.mutateAsync({
        name,
        category,
        unit,
        target_quantity: qty,
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
          <RNTextInput
            style={styles.editInput}
            value={name}
            onChangeText={setName}
            placeholder="Name"
            placeholderTextColor="#9ca3af"
            accessibilityLabel="Name"
          />
          <RNTextInput
            style={styles.editInput}
            value={category}
            onChangeText={setCategory}
            placeholder="Category"
            placeholderTextColor="#9ca3af"
            accessibilityLabel="Category"
          />
          <RNTextInput
            style={styles.editInput}
            value={unit}
            onChangeText={setUnit}
            placeholder="Unit"
            placeholderTextColor="#9ca3af"
            accessibilityLabel="Unit"
          />
          <RNTextInput
            style={styles.editInput}
            value={targetQty}
            onChangeText={setTargetQty}
            placeholder="Target quantity"
            placeholderTextColor="#9ca3af"
            keyboardType="numeric"
            accessibilityLabel="Target quantity"
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
        onPress={() => onOpen(item.id)}
        style={({ pressed }) => [pressed && styles.pressed]}
        accessibilityLabel={item.name}
        accessibilityHint="Opens batch details"
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
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [creatingItem, setCreatingItem] = useState(false);

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
        <RNTextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search items..."
          placeholderTextColor="#9ca3af"
          style={styles.searchInput}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
        <View style={styles.addButtonWrap}>
          <Button
            label={search === "" ? "Add new item" : `Add '${search}'`}
            onPress={() => setCreatingItem(true)}
          />
        </View>
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
            onOpen={setActiveItemId}
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

      {activeItemId !== null ? (
        <BatchSheetModal
          inventoryId={inventoryId}
          itemId={activeItemId}
          onClose={() => setActiveItemId(null)}
        />
      ) : null}

      {creatingItem ? (
        <EditItemModal
          key="create"
          visible={creatingItem}
          inventoryId={inventoryId}
          initialName={search || undefined}
          onClose={() => setCreatingItem(false)}
        />
      ) : null}
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
  addButtonWrap: { marginTop: 8 },
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

  // ── Modal / bottom sheet ──────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  backdrop: { ...StyleSheet.absoluteFillObject },
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
  },
  sheetTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  closeBtn: {
    position: "absolute",
    right: 16,
    top: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f6",
  },
  closeBtnLabel: { fontSize: 14, color: "#374151", fontWeight: "600" },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  modalBody: { padding: 16, gap: 4 },
  sheetLoading: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetHeader: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  sheetItemName: { fontSize: 20, fontWeight: "700", color: "#111827" },
  sheetItemCategory: { fontSize: 14, color: "#6b7280", marginTop: 2 },
  sheetBody: { padding: 16, gap: 8 },
  batchSpacer: { marginBottom: 8 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  section: { marginTop: 4 },
  formField: { marginBottom: 12 },
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
});
