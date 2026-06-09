package main

import (
	"context"
	"fmt"
	"os"
)

func main() {
	if err := run(context.Background()); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}

func run(_ context.Context) error {
	// TODO: load config, wire dependencies, start HTTP server + River workers
	fmt.Println("baskety starting…")
	return nil
}
