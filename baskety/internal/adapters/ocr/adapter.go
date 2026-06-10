package ocr

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
)

// TesseractOCR shells out to the tesseract binary to extract text from an image.
type TesseractOCR struct {
	Binary string
}

func NewTesseractOCR(binary string) *TesseractOCR {
	if binary == "" {
		binary = "tesseract"
	}
	return &TesseractOCR{Binary: binary}
}

// ExtractText runs `tesseract <imagePath> stdout` and returns the recognized text.
func (t *TesseractOCR) ExtractText(ctx context.Context, imagePath string) (string, error) {
	var out, errBuf bytes.Buffer
	cmd := exec.CommandContext(ctx, t.Binary, imagePath, "stdout")
	cmd.Stdout = &out
	cmd.Stderr = &errBuf
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("tesseract: %w: %s", err, errBuf.String())
	}
	return out.String(), nil
}
