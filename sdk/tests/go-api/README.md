# Go API for SelfBackendVerifier Testing

This is a Go API server that provides endpoints for testing the SelfBackendVerifier functionality, equivalent to the TypeScript API version.

## Setup

1. Initialize Go module dependencies:
```bash
go mod tidy
```

2. Build the project:
```bash
go build -o go-api
```

3. Run the server:
```bash
./go-api
```

Or run directly with Go:
```bash
go run main.go
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

### Environment Variables

- `PORT`: Server port (default: 8080)

### Storage

This API uses in-memory storage for testing purposes:
- Verification configuration is hard-coded (minimum age: 18, excludes PAK/IRN, OFAC enabled)
- Configuration data is stored in memory
- Data is lost when server restarts


## Docker Setup

### Building and Running with Docker

**Option 1: Using the build script (Recommended)**
```bash
# From the monorepo root directory
./sdk/tests/go-api/docker-build.sh

# Run the container
docker run -p 8080:8080 selfxyz-go-api:latest
```

**Option 2: Manual Docker build**
```bash
# From the monorepo root directory
docker build -f sdk/tests/go-api/Dockerfile -t selfxyz-go-api:latest .

# Run the container
docker run -p 8080:8080 selfxyz-go-api:latest
```

**Option 3: Using Docker Compose**
```bash
# From the go-api directory
cd sdk/tests/go-api
docker-compose up --build
```

The Docker container includes:
- Health check endpoint at `/health`
- Automatic restart policy
- Non-root user for security

### Docker Environment Variables

- `PORT`: Server port (default: 8080)
