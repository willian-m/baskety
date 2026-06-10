package receipt

import (
	"context"
	"log/slog"
	"sync"
)

// JobQueue enqueues background work. The Sprint 6 target is River; this sprint
// ships an in-process goroutine-backed implementation behind the same interface.
// TODO(sprint-7+): swap InProcessQueue for a River-backed implementation.
type JobQueue interface {
	Enqueue(ctx context.Context, jobType string, payload any) error
}

// Handler processes a single job payload.
type JobHandler func(ctx context.Context, payload any) error

// InProcessQueue dispatches jobs to a pool of goroutine workers.
type InProcessQueue struct {
	handlers map[string]JobHandler
	jobs     chan queuedJob
	wg       sync.WaitGroup
	once     sync.Once
}

type queuedJob struct {
	jobType string
	payload any
}

func NewInProcessQueue(workers, buffer int) *InProcessQueue {
	if workers <= 0 {
		workers = 2
	}
	if buffer <= 0 {
		buffer = 64
	}
	q := &InProcessQueue{
		handlers: make(map[string]JobHandler),
		jobs:     make(chan queuedJob, buffer),
	}
	for i := 0; i < workers; i++ {
		q.wg.Add(1)
		go q.worker()
	}
	return q
}

// Register associates a job type with its handler. Must be called before Enqueue.
func (q *InProcessQueue) Register(jobType string, h JobHandler) {
	q.handlers[jobType] = h
}

func (q *InProcessQueue) Enqueue(ctx context.Context, jobType string, payload any) error {
	select {
	case q.jobs <- queuedJob{jobType: jobType, payload: payload}:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (q *InProcessQueue) worker() {
	defer q.wg.Done()
	for job := range q.jobs {
		h, ok := q.handlers[job.jobType]
		if !ok {
			slog.Error("no handler for job type", "type", job.jobType)
			continue
		}
		if err := h(context.Background(), job.payload); err != nil {
			slog.Error("job handler failed", "type", job.jobType, "error", err)
		}
	}
}

// Shutdown stops accepting jobs and waits for in-flight work to complete.
func (q *InProcessQueue) Shutdown() {
	q.once.Do(func() { close(q.jobs) })
	q.wg.Wait()
}
