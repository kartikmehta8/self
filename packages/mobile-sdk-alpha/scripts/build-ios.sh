#!/bin/bash
# SPDX-FileCopyrightText: 2025 Social Connect Labs, Inc.
# SPDX-License-Identifier: BUSL-1.1
# NOTE: Converts to Apache-2.0 on 2029-06-11 per LICENSE.

# Build iOS XCFrameworks using mobile-sdk-native submodule and copy to ios/Frameworks

set -e

echo "🍎 Building iOS XCFrameworks for mobile-sdk-alpha..."

# Get absolute path to SDK directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SDK_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$SDK_DIR"

# Paths
MOBILE_SDK_NATIVE_DIR="mobile-sdk-native"
BUILD_SCRIPT="$MOBILE_SDK_NATIVE_DIR/ios/build-xcframeworks.sh"
BUILD_OUTPUT_DIR="$MOBILE_SDK_NATIVE_DIR/ios/build/xcframeworks"
TARGET_DIR="ios/Frameworks"

NFCPASSPORTREADER_XCFRAMEWORK="NFCPassportReader.xcframework"
OPENSSL_XCFRAMEWORK="OpenSSL.xcframework"

# Check if mobile-sdk-native submodule exists
if [ ! -d "$MOBILE_SDK_NATIVE_DIR" ]; then
    echo "❌ Error: mobile-sdk-native submodule not found at $MOBILE_SDK_NATIVE_DIR"
    echo "💡 Please initialize the submodule: git submodule update --init --recursive"
    exit 1
fi

# Check if build script exists
if [ ! -f "$BUILD_SCRIPT" ]; then
    echo "❌ Error: Build script not found at $BUILD_SCRIPT"
    exit 1
fi

# Step 1: Build xcframeworks using the submodule script
echo "🔨 Step 1: Building xcframeworks using mobile-sdk-native..."
cd "$MOBILE_SDK_NATIVE_DIR/ios"
if [ ! -x "./build-xcframeworks.sh" ]; then
    chmod +x "./build-xcframeworks.sh"
fi
./build-xcframeworks.sh
cd "$SDK_DIR"

# Step 2: Verify build output
if [ ! -d "$BUILD_OUTPUT_DIR/$NFCPASSPORTREADER_XCFRAMEWORK" ]; then
    echo "❌ Error: $NFCPASSPORTREADER_XCFRAMEWORK not found in build output at $BUILD_OUTPUT_DIR"
    exit 1
fi

if [ ! -d "$BUILD_OUTPUT_DIR/$OPENSSL_XCFRAMEWORK" ]; then
    echo "❌ Error: $OPENSSL_XCFRAMEWORK not found in build output at $BUILD_OUTPUT_DIR"
    exit 1
fi

# Step 3: Ensure target directory exists
echo "📦 Step 2: Copying xcframeworks to $TARGET_DIR..."
mkdir -p "$TARGET_DIR"

# Step 4: Copy NFCPassportReader.xcframework
echo "📦 Copying $NFCPASSPORTREADER_XCFRAMEWORK..."
rm -rf "$TARGET_DIR/$NFCPASSPORTREADER_XCFRAMEWORK"
cp -R "$BUILD_OUTPUT_DIR/$NFCPASSPORTREADER_XCFRAMEWORK" "$TARGET_DIR/$NFCPASSPORTREADER_XCFRAMEWORK"

# Step 5: Copy OpenSSL.xcframework
echo "📦 Copying $OPENSSL_XCFRAMEWORK..."
rm -rf "$TARGET_DIR/$OPENSSL_XCFRAMEWORK"
cp -RL "$BUILD_OUTPUT_DIR/$OPENSSL_XCFRAMEWORK" "$TARGET_DIR/$OPENSSL_XCFRAMEWORK"

echo "✅ XCFrameworks built and copied successfully"
echo "📦 NFCPassportReader XCFramework: $TARGET_DIR/$NFCPASSPORTREADER_XCFRAMEWORK"
echo "📦 OpenSSL XCFramework: $TARGET_DIR/$OPENSSL_XCFRAMEWORK"
echo "💡 These frameworks are used by the podspec at ios/Frameworks/"
