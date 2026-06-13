package ocr

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

type HTTPOCRAdapter struct {
	endpointURL string
	client      *http.Client
}

func NewHTTPOCR(endpointURL string) *HTTPOCRAdapter {
	return &HTTPOCRAdapter{
		endpointURL: endpointURL,
		client:      &http.Client{Timeout: 120 * time.Second},
	}
}

func (a *HTTPOCRAdapter) ExtractText(ctx context.Context, imagePath string) (string, error) {
	f, err := os.Open(imagePath)
	if err != nil {
		return "", fmt.Errorf("ocr: open image: %w", err)
	}
	defer f.Close()

	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	part, err := mw.CreateFormFile("image", filepath.Base(imagePath))
	if err != nil {
		return "", fmt.Errorf("ocr: create form file: %w", err)
	}
	if _, err = io.Copy(part, f); err != nil {
		return "", fmt.Errorf("ocr: copy image: %w", err)
	}
	if err := mw.Close(); err != nil {
		return "", fmt.Errorf("ocr: close multipart: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, a.endpointURL+"/ocr", &buf)
	if err != nil {
		return "", fmt.Errorf("ocr: build request: %w", err)
	}
	req.Header.Set("Content-Type", mw.FormDataContentType())

	resp, err := a.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("ocr: request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<10))
		return "", fmt.Errorf("ocr: service returned %d: %s", resp.StatusCode, body)
	}

	var result struct {
		Text string `json:"text"`
	}
	if err = json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("ocr: decode response: %w", err)
	}
	return result.Text, nil
}
