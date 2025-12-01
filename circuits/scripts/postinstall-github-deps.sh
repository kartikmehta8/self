#!/bin/bash

# Create symlinks for GitHub dependencies to maintain circom include path compatibility
# This is needed because circom files include from package names that don't match
# the repository structure when installed directly from GitHub

CIRCUITS_DIR="$(dirname "$0")/../node_modules"

# Handle anon-aadhaar-circuits
# Remove existing symlink or directory if it exists
if [ -L "$CIRCUITS_DIR/anon-aadhaar-circuits" ] || [ -d "$CIRCUITS_DIR/anon-aadhaar-circuits" ]; then
    rm -rf "$CIRCUITS_DIR/anon-aadhaar-circuits"
fi

# Create symlink from anon-aadhaar-circuits to anon-aadhaar/packages/circuits
if [ -d "$CIRCUITS_DIR/anon-aadhaar/packages/circuits" ]; then
    ln -s "anon-aadhaar/packages/circuits" "$CIRCUITS_DIR/anon-aadhaar-circuits"
    echo "✓ Created symlink: anon-aadhaar-circuits -> anon-aadhaar/packages/circuits"
elif [ -d "$CIRCUITS_DIR/anon-aadhaar" ]; then
    # Fallback: if the structure is different, link to the root
    ln -s "anon-aadhaar" "$CIRCUITS_DIR/anon-aadhaar-circuits"
    echo "✓ Created symlink: anon-aadhaar-circuits -> anon-aadhaar"
else
    echo "⚠ Warning: anon-aadhaar package not found in node_modules"
fi

# Handle @zk-kit/binary-merkle-root.circom
# The package name includes @ and / which need special handling
ZK_KIT_DIR="$CIRCUITS_DIR/@zk-kit"
mkdir -p "$ZK_KIT_DIR"

# Remove existing symlink or directory if it exists
if [ -L "$ZK_KIT_DIR/binary-merkle-root.circom" ] || [ -d "$ZK_KIT_DIR/binary-merkle-root.circom" ]; then
    rm -rf "$ZK_KIT_DIR/binary-merkle-root.circom"
fi

# Create symlink from @zk-kit/binary-merkle-root.circom to zk-kit.circom/packages/binary-merkle-root
if [ -d "$CIRCUITS_DIR/zk-kit.circom/packages/binary-merkle-root" ]; then
    ln -s "../zk-kit.circom/packages/binary-merkle-root" "$ZK_KIT_DIR/binary-merkle-root.circom"
    echo "✓ Created symlink: @zk-kit/binary-merkle-root.circom -> zk-kit.circom/packages/binary-merkle-root"
elif [ -d "$CIRCUITS_DIR/zk-kit.circom" ]; then
    # Fallback: if the structure is different, link to the root
    ln -s "../zk-kit.circom" "$ZK_KIT_DIR/binary-merkle-root.circom"
    echo "✓ Created symlink: @zk-kit/binary-merkle-root.circom -> zk-kit.circom"
else
    echo "⚠ Warning: zk-kit.circom package not found in node_modules"
fi
