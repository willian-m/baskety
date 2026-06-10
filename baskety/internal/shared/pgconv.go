package shared

import (
	"math"
	"math/big"
	"strconv"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// UUIDToPg converts a uuid.UUID to pgtype.UUID.
func UUIDToPg(id uuid.UUID) pgtype.UUID {
	return pgtype.UUID{Bytes: id, Valid: true}
}

// UUIDPtrToPg converts a *uuid.UUID to pgtype.UUID (invalid when nil).
func UUIDPtrToPg(id *uuid.UUID) pgtype.UUID {
	if id == nil {
		return pgtype.UUID{}
	}
	return pgtype.UUID{Bytes: *id, Valid: true}
}

// PgToUUID converts a pgtype.UUID to uuid.UUID.
func PgToUUID(id pgtype.UUID) uuid.UUID {
	return uuid.UUID(id.Bytes)
}

// PgToUUIDPtr converts a pgtype.UUID to *uuid.UUID (nil when invalid).
func PgToUUIDPtr(id pgtype.UUID) *uuid.UUID {
	if !id.Valid {
		return nil
	}
	u := uuid.UUID(id.Bytes)
	return &u
}

// FloatToPgNumeric converts a float64 to pgtype.Numeric.
// Uses strconv formatting to avoid scientific notation.
func FloatToPgNumeric(f float64) pgtype.Numeric {
	var n pgtype.Numeric
	s := strconv.FormatFloat(f, 'f', -1, 64)
	_ = n.Scan(s)
	return n
}

// PgNumericToFloat converts a pgtype.Numeric to float64.
func PgNumericToFloat(n pgtype.Numeric) float64 {
	if !n.Valid || n.Int == nil {
		return 0
	}
	f, _ := new(big.Float).SetInt(n.Int).Float64()
	if n.Exp != 0 {
		scale := new(big.Float).SetFloat64(math.Pow10(int(n.Exp)))
		f, _ = new(big.Float).Mul(new(big.Float).SetFloat64(f), scale).Float64()
	}
	if n.InfinityModifier == pgtype.NegativeInfinity {
		return -f
	}
	return f
}

// PtrStr converts *string to string (empty string when nil).
func PtrStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// StrToPtr converts string to *string (nil when empty).
func StrToPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
