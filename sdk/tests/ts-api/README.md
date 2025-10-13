# TypeScript API for SelfBackendVerifier Testing

This is a TypeScript API server that provides endpoints for testing the SelfBackendVerifier functionality.

## Setup

1. Install dependencies:
```bash
yarn install
```

2. Build the project:
```bash
yarn build
```

3. Start the server:
```bash
yarn start
```

Or for development with hot reload:
```bash
yarn dev
```

## API Endpoints

### Health Check
```
GET /health
```
Returns server status and timestamp.

### Verify Attestation
```
POST /api/verify
Content-Type: application/json

{
  "attestationId": 1,
  "proof": {
    "a": ["...", "..."],
    "b": [["...", "..."], ["...", "..."]],
    "c": ["...", "..."]
  },
  "publicSignals": ["...", "...", "..."],
  "userContextData": "..."
}
```


## Docker Setup

### Building and Running with Docker

**Option 1: Using the build script (Recommended)**
```bash
# From the monorepo root directory
./sdk/tests/ts-api/docker-build.sh

# Run the container
docker run -p 3000:3000 selfxyz-ts-api:latest
```

**Option 2: Manual Docker build**
```bash
# From the monorepo root directory
docker build -f sdk/tests/ts-api/Dockerfile -t selfxyz-ts-api:latest .

# Run the container
docker run -p 3000:3000 selfxyz-ts-api:latest
```

**Option 3: Using Docker Compose**
```bash
# From the ts-api directory
cd sdk/tests/ts-api
docker-compose up --build
```


## Development vs Docker

### Local Development
```bash
yarn dev        # Uses tsx with hot reload
```

### Docker Production
```bash
yarn build      # Compiles TypeScript
yarn start      # Runs compiled JavaScript
```
