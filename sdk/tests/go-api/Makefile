# Go API Makefile for SelfBackendVerifier Testing

.PHONY: help build run clean test docker-build docker-run docker-compose docker-test

# Default target
help:
	@echo "Available targets:"
	@echo "  build         - Build the Go binary"
	@echo "  run           - Run the API server locally"
	@echo "  clean         - Clean build artifacts"
	@echo "  test          - Test the running API endpoints"
	@echo "  docker-build  - Build Docker image"
	@echo "  docker-run    - Run Docker container"
	@echo "  docker-compose- Run with docker-compose"
	@echo "  docker-test   - Test the dockerized API"

# Build the Go binary
build:
	@echo "Building Go API..."
	go mod tidy
	go build -o go-api .
	@echo "Build complete: ./go-api"

# Run the API server locally
run: build
	@echo "Starting Go API server on port 8080..."
	./go-api

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -f go-api
	go clean

# Test the running API endpoints
test:
	@echo "Testing Go API endpoints..."
	./test-api.sh

# Build Docker image
docker-build:
	@echo "Building Docker image..."
	cd ../../.. && ./sdk/tests/go-api/docker-build.sh

# Run Docker container
docker-run:
	@echo "Running Docker container..."
	docker run -p 8080:8080 selfxyz-go-api:latest

# Run with docker-compose
docker-compose:
	@echo "Starting with docker-compose..."
	docker-compose up --build

# Test the dockerized API
docker-test:
	@echo "Testing dockerized Go API..."
	@echo "Waiting for container to start..."
	@sleep 5
	./test-api.sh
