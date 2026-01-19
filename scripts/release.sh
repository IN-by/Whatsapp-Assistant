#!/bin/bash
set -e

# Configuration
KEY_FILE="key.pem"
EXTENSION_DIR="."
DIST_DIR="dist"
UPDATES_XML="updates.xml"
MANIFEST="manifest.json"
REPO_URL="https://github.com/IN-by/Whatsapp-Assistant"

# Ensure key exists
if [ ! -f "$KEY_FILE" ]; then
    echo "Error: $KEY_FILE not found!"
    exit 1
fi

# Get current version from manifest
VERSION=$(grep '"version":' "$MANIFEST" | cut -d'"' -f4)
echo "Packaging version $VERSION..."

# Create dist directory
mkdir -p "$DIST_DIR"

# Clean previous build
rm -f "$DIST_DIR/extension.crx" "$DIST_DIR/extension.zip"

# Create ZIP (for reference/store)
zip -r "$DIST_DIR/extension.zip" . -x "*.git*" -x "$DIST_DIR/*" -x "$KEY_FILE" -x "scripts/*" -x ".agent/*"

# Create CRX
# Using chrome to pack is tricky in headless execution. 
# We will use a simple specialized python script inline to pack it using the pem key 
# OR we rely on 'google-chrome --pack-extension=... --pack-extension-key=...' if available.
# Since we might be on a minimal environment, let's use a python packer for stability if Chrome isn't guaranteed in path.
# However, for simplicity here, I'll write a small python helper to pack crx.

python3 -c "
import sys, os, struct, subprocess
from glob import glob

def create_header(pub_key, sig):
    # CRX3 Header Format is complex (Protobuf).
    # CRX2 is simpler but deprecated. 
    # For robust modern usage, we ideally use 'crx3' npm package or 'google-chrome' cli.
    # FALLBACK: If we can't easily pack CRX3, we might need the user to do it or use a library.
    # BUT wait, the goal is 'Standard Process'.
    # Let's try to assume 'openssl' and manual CRX2 creation if Cr3 is hard, 
    # but Chrome really wants CRX3 now for some things. 
    # Actually, for self-hosted, CRX2 might be rejected.
    pass
"

# AUTOMATION CHECK:
# If we cannot reliably pack CRX3 without external tools, we will use 'zip' and tell user 
# "For auto-updates to work securely, Chrome requires CRX3."
# The simplest way for a user on Mac is to use Chrome itself.
# "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --pack-extension=...

CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ ! -f "$CHROME_BIN" ]; then
    echo "Warning: Google Chrome binary not found at standard location."
    echo "Attempting to find it..."
    CHROME_BIN=$(mdfind kMDItemCFBundleIdentifier == "com.google.Chrome" | head -n 1)/Contents/MacOS/Google Chrome
fi

if [ -f "$CHROME_BIN" ]; then
    echo "Using Chrome to pack extension..."
    "$CHROME_BIN" --pack-extension="$PWD" --pack-extension-key="$PWD/$KEY_FILE" --no-message-box
    mv "$PWD/whatsapp.crx" "$DIST_DIR/extension.crx"
else
    echo "Error: Google Chrome not found. Cannot pack CRX3."
    exit 1
fi

# Update updates.xml with new version
# This matches the <updatecheck> tag and updates 'version' and 'codebase'
# We use a temp file to avoid sed complications with urls
echo "Updating $UPDATES_XML..."
sed -i '' "s|version='[^']*'|version='$VERSION'|g" "$UPDATES_XML"
sed -i '' "s|codebase='[^']*'|codebase='$REPO_URL/releases/download/v$VERSION/extension.crx'|g" "$UPDATES_XML"

echo "Done! Artifacts in $DIST_DIR/"
echo "1. Commit changes (including updates.xml)"
echo "2. Create a tag v$VERSION"
echo "3. Push tag and code"
echo "4. Create GitHub Release for v$VERSION and attach dist/extension.crx"
