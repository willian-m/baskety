package llm

import (
	"encoding/json"
	"log/slog"
	"os"
	"sync"
	"time"
)

// llmLogFile is an optional path (set via BASKETY_LLM_LOG_FILE) where every LLM
// request/response exchange is appended as a JSON line. It is meant as a
// developer aid for iterating on the prompt — `tail -f` the file to see exactly
// what was sent and what came back. When unset, exchanges are still summarised
// to the standard logger (see recordExchange).
var (
	llmLogFile = os.Getenv("BASKETY_LLM_LOG_FILE")
	llmLogMu   sync.Mutex
)

// exchangeRecord is one logged LLM request/response, written to the debug file.
type exchangeRecord struct {
	Time      time.Time `json:"time"`
	Provider  string    `json:"provider"`
	Model     string    `json:"model"`
	Prompt    string    `json:"prompt"`
	Response  string    `json:"response"`
	ItemCount int       `json:"item_count"`
	Error     string    `json:"error,omitempty"`
}

// recordExchange centralises observability for a single LLM call. It always
// emits a concise INFO summary (visible in `docker logs` at the default level),
// logs the full prompt+response at DEBUG, and — when BASKETY_LLM_LOG_FILE is set
// — appends the complete exchange to that file for prompt iteration.
func recordExchange(provider, model, prompt, response string, itemCount int, err error) {
	errStr := ""
	if err != nil {
		errStr = err.Error()
	}

	slog.Info("llm exchange",
		"provider", provider,
		"model", model,
		"response_bytes", len(response),
		"item_count", itemCount,
		"error", errStr,
	)
	// The full response is logged at INFO too: it is the single most useful thing
	// for diagnosing parse failures and tuning the prompt, and self-hosters read
	// it straight from the container logs.
	slog.Info("llm raw response", "provider", provider, "response", response)
	slog.Debug("llm prompt", "provider", provider, "prompt", prompt)

	if llmLogFile == "" {
		return
	}
	rec := exchangeRecord{
		Time:      time.Now(),
		Provider:  provider,
		Model:     model,
		Prompt:    prompt,
		Response:  response,
		ItemCount: itemCount,
		Error:     errStr,
	}
	llmLogMu.Lock()
	defer llmLogMu.Unlock()
	f, ferr := os.OpenFile(llmLogFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if ferr != nil {
		slog.Warn("llm log file open failed", "path", llmLogFile, "error", ferr)
		return
	}
	defer f.Close()
	if encErr := json.NewEncoder(f).Encode(rec); encErr != nil {
		slog.Warn("llm log file write failed", "path", llmLogFile, "error", encErr)
	}
}
