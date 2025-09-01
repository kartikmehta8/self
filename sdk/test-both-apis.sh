#!/bin/bash

# API Query Test Script
# Sends test queries to both TypeScript API (port 3000) and Go API (port 8080)
# Assumes both APIs are already running (use ./run-apis.sh up to start them)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_header() {
    echo -e "${PURPLE}================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}================================${NC}"
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_api_header() {
    echo -e "${CYAN}--- $1 ---${NC}"
}

# Configuration
TS_API_URL="http://localhost:3000"
GO_API_URL="http://localhost:8080"
PROOF_FILE="tests/ts-api/vc_and_disclose_proof.json"

# Function to show usage
show_usage() {
    echo "Usage: $0"
    echo ""
    echo "This script sends test queries to both APIs:"
    echo "  - TypeScript API: http://localhost:3000/api/verify"
    echo "  - Go API: http://localhost:8080/api/verify"
    echo ""
    echo "Prerequisites:"
    echo "  1. Start both APIs first: ./run-apis.sh up"
    echo "  2. Run this script from the sdk directory"
}

# Check if we're in the correct directory and proof file exists
check_prerequisites() {
    if [[ ! -f "$PROOF_FILE" ]]; then
        print_error "Proof data file not found: $PROOF_FILE"
        print_error "Please run this script from the sdk directory"
        exit 1
    fi

    # Check if jq is available
    if ! command -v jq &> /dev/null; then
        print_warning "jq not found. JSON responses will not be formatted."
        print_status "Install jq for better output: sudo apt-get install jq (Ubuntu/Debian)"
    fi

    # Check if curl is available
    if ! command -v curl &> /dev/null; then
        print_error "curl is required but not found. Please install curl."
        exit 1
    fi
}

# Send test queries to both APIs
send_test_queries() {
    print_header "Sending Test Queries to Both APIs"

    # Read proof data
    local proof_data=$(cat "$PROOF_FILE")
    local proof=$(echo "$proof_data" | jq '.proof')
    local public_signals=$(echo "$proof_data" | jq '.publicSignals')

    # Create request body
    local request_body=$(cat << EOF
{
    "attestationId": 1,
    "proof": $proof,
    "publicSignals": $public_signals,
    "userContextData": "000000000000000000000000000000000000000000000000000000000000a4ec00000000000000000000000094ba0db8a9db66979905784a9d6b2d286e55bd27"
}
EOF
)

    print_status "Test data loaded from: $PROOF_FILE"
    echo ""

    # Test both APIs in parallel
    print_api_header "Querying TypeScript API (port 3000)"
    test_single_api "$TS_API_URL" "TypeScript" "$request_body" &
    local ts_pid=$!

    print_api_header "Querying Go API (port 8080)"
    test_single_api "$GO_API_URL" "Go" "$request_body" &
    local go_pid=$!

    # Wait for both to complete
    wait $ts_pid
    local ts_result=$?

    wait $go_pid
    local go_result=$?

    echo ""
    print_header "Query Results Summary"

    if [[ $ts_result -eq 0 ]]; then
        print_success "TypeScript API: SUCCESS ✅"
    else
        print_error "TypeScript API: FAILED ❌"
    fi

    if [[ $go_result -eq 0 ]]; then
        print_success "Go API: SUCCESS ✅"
    else
        print_error "Go API: FAILED ❌"
    fi

    if [[ $ts_result -eq 0 && $go_result -eq 0 ]]; then
        echo ""
        print_success "🎉 Both APIs responded successfully! 🎉"
    else
        echo ""
        print_warning "⚠️  Some queries failed. Make sure both APIs are running with: ./run-apis.sh up"
    fi
}

# Test a single API
test_single_api() {
    local base_url="$1"
    local api_name="$2"
    local request_body="$3"
    local endpoint="${base_url}/api/verify"

    print_status "Sending request to: $endpoint"

    # Make the request
    local response
    local http_status

    response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d "$request_body" \
        --connect-timeout 30 \
        --max-time 60 \
        "$endpoint" 2>/dev/null)

    if [[ $? -ne 0 ]]; then
        print_error "$api_name API: Connection failed"
        print_error "Make sure the API is running on ${base_url}"
        return 1
    fi

    # Extract HTTP status and body
    http_status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    local response_body=$(echo "$response" | sed 's/HTTPSTATUS:[0-9]*$//')

    print_status "$api_name API Response Status: $http_status"

    # Pretty print JSON response if possible
    if echo "$response_body" | jq . > /dev/null 2>&1; then
        echo "$response_body" | jq .
    else
        echo "$response_body"
    fi

    # Check if verification was successful
    if [[ "$http_status" == "200" ]]; then
        # Try to check if the result field indicates success
        local result_status=$(echo "$response_body" | jq -r '.result // false' 2>/dev/null)
        if [[ "$result_status" == "true" ]]; then
            print_success "$api_name API: Verification succeeded! ✅"
            return 0
        else
            print_warning "$api_name API: Response OK but verification failed"
            return 1
        fi
    else
        print_error "$api_name API: HTTP $http_status - Verification failed ❌"
        return 1
    fi
}

# Main script logic
main() {
    local command=${1:-test}

    case "$command" in
        "test"|"")
            check_prerequisites
            send_test_queries
            ;;
        "help"|"-h"|"--help")
            show_usage
            ;;
        *)
            print_error "Unknown command: $command"
            echo ""
            show_usage
            exit 1
            ;;
    esac
}

# Run the main function with all arguments
main "$@"
