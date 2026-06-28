package ocr

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"

	"github.com/willian-m/baskety/internal/receipt"
)

var _ receipt.OCRProvider = (*TesseractOCR)(nil)

// TesseractOCR shells out to the tesseract binary to extract text from an image.
type TesseractOCR struct {
	Binary string
	// Languages is the tesseract -l value, e.g. "por+eng" for Portuguese+English.
	// The matching language data packs must be installed for the binary.
	Languages string
}

func NewTesseractOCR(binary, languages string) *TesseractOCR {
	if binary == "" {
		binary = "tesseract"
	}
	if languages == "" {
		languages = "por+eng"
	}
	return &TesseractOCR{Binary: binary, Languages: languages}
}

// ExtractText runs `tesseract <imagePath> stdout -l <languages>` and returns the
// recognized text.
func (t *TesseractOCR) ExtractText(ctx context.Context, imagePath string) (string, error) {
	var out, errBuf bytes.Buffer
	cmd := exec.CommandContext(ctx, t.Binary, imagePath, "stdout", "-l", t.Languages)
	cmd.Stdout = &out
	cmd.Stderr = &errBuf
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("tesseract: %w: %s", err, errBuf.String())
	}
	return out.String(), nil
}
