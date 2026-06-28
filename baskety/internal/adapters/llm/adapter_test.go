package llm

import "testing"

func ptrI64(v int64) *int64     { return &v }
func ptrF64(v float64) *float64 { return &v }

func TestReconcilePrices_DeriveUnitFromTotal(t *testing.T) {
	unit, total := reconcilePrices(nil, ptrI64(300), ptrF64(2))
	if unit == nil || *unit != 150 {
		t.Fatalf("expected unit price 150, got %v", unit)
	}
	if total == nil || *total != 300 {
		t.Fatalf("expected total to stay 300, got %v", total)
	}
}

func TestReconcilePrices_PackagedQtyOne(t *testing.T) {
	// Packaged item: quantity defaults to 1, so a total yields an equal unit price.
	unit, total := reconcilePrices(nil, ptrI64(450), ptrF64(1))
	if unit == nil || *unit != 450 {
		t.Fatalf("expected unit price 450, got %v", unit)
	}
	if total == nil || *total != 450 {
		t.Fatalf("expected total 450, got %v", total)
	}
}

func TestReconcilePrices_WeighedItem(t *testing.T) {
	// Sold by weight: 0.4 kg at 1000/kg -> total 400.
	unit, total := reconcilePrices(ptrI64(1000), nil, ptrF64(0.4))
	if total == nil || *total != 400 {
		t.Fatalf("expected total 400, got %v", total)
	}
	if unit == nil || *unit != 1000 {
		t.Fatalf("expected unit 1000, got %v", unit)
	}
}

func TestReconcilePrices_DeriveTotalFromUnit(t *testing.T) {
	unit, total := reconcilePrices(ptrI64(150), nil, ptrF64(3))
	if total == nil || *total != 450 {
		t.Fatalf("expected total 450, got %v", total)
	}
	if unit == nil || *unit != 150 {
		t.Fatalf("expected unit to stay 150, got %v", unit)
	}
}

func TestReconcilePrices_NoQuantityLeavesNil(t *testing.T) {
	unit, total := reconcilePrices(nil, ptrI64(300), nil)
	if unit != nil {
		t.Fatalf("expected unit nil without quantity, got %v", *unit)
	}
	if total == nil || *total != 300 {
		t.Fatalf("expected total to stay 300, got %v", total)
	}
}

func TestReconcilePrices_DoesNotOverwriteProvidedValues(t *testing.T) {
	// Both present and inconsistent: we keep what the model gave us verbatim so
	// the review UI can flag the mismatch rather than silently "fixing" it.
	unit, total := reconcilePrices(ptrI64(150), ptrI64(999), ptrF64(2))
	if *unit != 150 || *total != 999 {
		t.Fatalf("expected provided values preserved, got unit=%d total=%d", *unit, *total)
	}
}

func TestToParsedLineItems_ParsesTotalPrice(t *testing.T) {
	const resp = `[{"name":"Tomato","quantity":2,"unit":"ea","price_per_unit_minor":150,"total_price_minor":300,"raw_text":"TOM AT 2 x 1,50 3,00","confidence":0.55}]`
	items, err := toParsedLineItems(resp)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(items))
	}
	it := items[0]
	if it.ParsedPriceMinor == nil || *it.ParsedPriceMinor != 150 {
		t.Fatalf("expected unit price 150, got %v", it.ParsedPriceMinor)
	}
	if it.ParsedTotalPriceMinor == nil || *it.ParsedTotalPriceMinor != 300 {
		t.Fatalf("expected total price 300, got %v", it.ParsedTotalPriceMinor)
	}
}

func TestParseLineItemsResponse_BareArray(t *testing.T) {
	const resp = `[{"name":"Milk","raw_text":"MILK"}]`
	items, err := parseLineItemsResponse(resp)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != 1 || items[0].ParsedName == nil || *items[0].ParsedName != "Milk" {
		t.Fatalf("expected one Milk item, got %#v", items)
	}
}

func TestParseLineItemsResponse_ObjectWrapper(t *testing.T) {
	// This is the shape (object with an "items" array) that previously failed to
	// unmarshal into []lineItemJSON — the bug that motivated the tool/schema fix.
	const resp = `{"items":[{"name":"Milk","raw_text":"MILK"},{"name":"Eggs","raw_text":"EGGS"}]}`
	items, err := parseLineItemsResponse(resp)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(items))
	}
}

func TestParseLineItemsResponse_ObjectWrapperWithProse(t *testing.T) {
	const resp = "Here are the items:\n```json\n{\"line_items\":[{\"name\":\"Bread\",\"raw_text\":\"BREAD\"}]}\n```"
	items, err := parseLineItemsResponse(resp)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != 1 || items[0].ParsedName == nil || *items[0].ParsedName != "Bread" {
		t.Fatalf("expected one Bread item, got %#v", items)
	}
}

func TestLineItemsResultSchema_RootIsObjectWithItems(t *testing.T) {
	schema := lineItemsResultSchema()
	if schema["type"] != "object" {
		t.Fatalf("expected root type object, got %v", schema["type"])
	}
	props, ok := schema["properties"].(map[string]any)
	if !ok {
		t.Fatal("expected properties map")
	}
	if _, ok := props["items"]; !ok {
		t.Fatal("expected an items property")
	}
}

func TestLineItemsResultSchema_LineItemRequiresKeyFields(t *testing.T) {
	schema := lineItemsResultSchema()
	props := schema["properties"].(map[string]any)
	items := props["items"].(map[string]any)
	lineItem := items["items"].(map[string]any)
	required, ok := lineItem["required"].([]string)
	if !ok {
		t.Fatalf("expected required []string, got %T", lineItem["required"])
	}
	set := map[string]bool{}
	for _, r := range required {
		set[r] = true
	}
	for _, want := range []string{"confidence", "quantity", "unit", "price_per_unit_minor", "total_price_minor"} {
		if !set[want] {
			t.Errorf("expected %q to be required so the model populates it", want)
		}
	}
}
