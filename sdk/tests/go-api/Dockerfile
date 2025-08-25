# Multi-stage build for Go API
FROM golang:1.23-alpine AS builder

# Set working directory
WORKDIR /app

# Install git and ca-certificates (needed for go modules)
RUN apk --no-cache add git ca-certificates

# Copy go mod files from monorepo root and workspace
COPY go.mod go.sum ./
COPY sdk/tests/go-api/go.mod ./sdk/tests/go-api/
COPY sdk/sdk-go/ ./sdk/sdk-go/

# Copy the Go API source
COPY sdk/tests/go-api/ ./sdk/tests/go-api/

# Build the Go API
WORKDIR /app/sdk/tests/go-api
RUN go mod download
RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o go-api .

# Production stage - minimal Alpine image
FROM alpine:latest AS runner

# Install ca-certificates, wget for health check, and create non-root user
RUN apk --no-cache add ca-certificates wget \
    && addgroup --system --gid 1001 appgroup \
    && adduser --system --uid 1001 --ingroup appgroup appuser

# Set working directory
WORKDIR /app

# Copy the binary from builder stage
COPY --from=builder --chown=appuser:appgroup /app/sdk/tests/go-api/go-api .

# Switch to non-root user
USER appuser

# Expose port 8080
EXPOSE 8080

# Set environment variables
ENV PORT=8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run the binary
CMD ["./go-api"]
