#!/bin/bash

# Build the TypeScript API Docker image
# This script should be run from the monorepo root

set -e

echo " Building TypeScript API Docker image..."

# Check if we're in the monorepo root
if [ ! -f "package.json" ] || [ ! -d "sdk/tests/ts-api" ]; then
    echo " Error: This script must be run from the monorepo root"
    echo "Please run: cd ../../../ && ./sdk/tests/ts-api/docker-build.sh"
    exit 1
fi

# Build the Docker image
docker build -f sdk/tests/ts-api/Dockerfile -t selfxyz-ts-api:latest .

echo " Docker image 'selfxyz-ts-api:latest' built successfully!"
echo ""
echo "To run the container:"
echo "  docker run -p 3000:3000 selfxyz-ts-api:latest"
echo ""
echo "Or use docker-compose:"
echo "  cd sdk/tests/ts-api && docker-compose up"
