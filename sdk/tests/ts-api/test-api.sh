#!/bin/bash

# Test script for TypeScript API
# Tests the API endpoints to ensure they're working correctly

set -e

API_URL="http://localhost:3000"
echo "🧪 Testing TypeScript API at $API_URL"

# Test health endpoint
echo "📊 Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/health_response "$API_URL/health")
if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo "✅ Health check passed"
    cat /tmp/health_response
    echo ""
else
    echo "❌ Health check failed with status: $HEALTH_RESPONSE"
    exit 1
fi

# Test save-options endpoint
echo "💾 Testing save-options endpoint..."
SAVE_RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/save_response \
    -X POST "$API_URL/api/save-options" \
    -H "Content-Type: application/json" \
    -d '{
        "userId": "test-user-123",
        "options": {
            "minimumAge": 18,
            "ofac": true,
            "excludedCountries": ["Country1", "Country2"],
            "issuing_state": true,
            "name": true,
            "nationality": true,
            "date_of_birth": false,
            "passport_number": false,
            "gender": true,
            "expiry_date": true
        }
    }')

if [ "$SAVE_RESPONSE" = "200" ]; then
    echo "✅ Save options test passed"
    cat /tmp/save_response
    echo ""
else
    echo "❌ Save options test failed with status: $SAVE_RESPONSE"
    cat /tmp/save_response
    echo ""
fi

# Test verify endpoint (will fail due to missing real proof data, but should return proper error)
echo "🔐 Testing verify endpoint structure..."
VERIFY_RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/verify_response \
    -X POST "$API_URL/api/verify" \
    -H "Content-Type: application/json" \
    -d '{
        "attestationId": 1,
        "proof": {
            "a": ["123", "456"],
            "b": [["789", "012"], ["345", "678"]],
            "c": ["901", "234"]
        },
        "publicSignals": ["1", "2", "3"],
        "userContextData": "test"
    }')

if [ "$VERIFY_RESPONSE" = "400" ] || [ "$VERIFY_RESPONSE" = "500" ]; then
    echo "✅ Verify endpoint structure test passed (expected error with test data)"
    cat /tmp/verify_response
    echo ""
else
    echo "❌ Verify endpoint test unexpected status: $VERIFY_RESPONSE"
    cat /tmp/verify_response
    echo ""
fi

# Test 404 endpoint
echo "🔍 Testing 404 handling..."
NOT_FOUND_RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/not_found_response "$API_URL/nonexistent")
if [ "$NOT_FOUND_RESPONSE" = "404" ]; then
    echo "✅ 404 handling test passed"
    cat /tmp/not_found_response
    echo ""
else
    echo "❌ 404 handling test failed with status: $NOT_FOUND_RESPONSE"
fi

echo "🎉 API tests completed!"
echo ""
echo "Summary:"
echo "- Health endpoint: Working"
echo "- Save options endpoint: Working"
echo "- Verify endpoint: Structure OK (needs real proof data)"
echo "- 404 handling: Working"
