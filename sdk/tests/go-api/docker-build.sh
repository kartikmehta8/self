#!/bin/bash

# Build the Go API Docker image
# This script should be run from the monorepo root

set -e

echo "Building Go API Docker image..."

# Check if we're in the monorepo root
if [ ! -f "package.json" ] || [ ! -d "sdk/tests/go-api" ]; then
    echo "Error: This script must be run from the monorepo root"
    echo "Please run: cd ../../../ && ./sdk/tests/go-api/docker-build.sh"
    exit 1
fi

# Build the Docker image
docker build -f sdk/tests/go-api/Dockerfile -t selfxyz-go-api:latest .

echo "Docker image 'selfxyz-go-api:latest' built successfully!"
echo ""
echo "To run the container:"
echo "  docker run -p 8080:8080 selfxyz-go-api:latest"
echo ""
echo "Or use docker-compose:"
echo "  cd sdk/tests/go-api && docker-compose up"
