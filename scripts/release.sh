#!/bin/bash
set -e

# Configuration
DIST_DIR="dist"
MANIFEST="manifest.json"

# Get current version from manifest
VERSION=$(grep '"version":' "$MANIFEST" | cut -d'"' -f4)
echo "📦 Packaging version $VERSION for Chrome Web Store..."

# Create dist directory
mkdir -p "$DIST_DIR"

# Clean previous build
rm -f "$DIST_DIR/extension-v$VERSION.zip"

# Create temporary build directory
BUILD_DIR="build_tmp"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Copy files to build dir (excluding ignored ones)
if command -v rsync >/dev/null 2>&1; then
    rsync -av --exclude 'key.pem' \
              --exclude 'key.pem.bak' \
              --exclude 'dist' \
              --exclude 'scripts' \
              --exclude '.agent' \
              --exclude '.git' \
              --exclude '.gitignore' \
              --exclude '.DS_Store' \
              --exclude '.vscode' \
              --exclude 'node_modules' \
              --exclude '*.zip' \
              --exclude '*.crx' \
              --exclude 'update-core.sh' \
              --exclude 'README.md' \
              --exclude 'privacy-page' \
              . "$BUILD_DIR"
else
    # Fallback to simple copy and remove
    cp -R . "$BUILD_DIR"
    rm -f "$BUILD_DIR/key.pem"
    rm -f "$BUILD_DIR/key.pem.bak"
    rm -rf "$BUILD_DIR/dist"
    rm -rf "$BUILD_DIR/scripts"
    rm -rf "$BUILD_DIR/.agent"
    rm -rf "$BUILD_DIR/.git"
    rm -rf "$BUILD_DIR/.vscode"
    rm -rf "$BUILD_DIR/node_modules"
    rm -f "$BUILD_DIR"/*.zip
    rm -f "$BUILD_DIR"/*.crx
    rm -f "$BUILD_DIR/update-core.sh"
    rm -f "$BUILD_DIR/README.md"
    rm -rf "$BUILD_DIR/privacy-page"
fi

# Create ZIP for Web Store
# Chrome Web Store requires a ZIP file containing the manifest at the root.
cd "$BUILD_DIR"
zip -r "../$DIST_DIR/extension-v$VERSION.zip" . -x "*.DS_Store*"
cd ..

# Clean up
rm -rf "$BUILD_DIR"

echo "✅ Build success! Artifact: $DIST_DIR/extension-v$VERSION.zip"
echo ""
echo "👉 Next Steps:"
echo "1. Upload '$DIST_DIR/extension-v$VERSION.zip' to Chrome Web Store Developer Dashboard."
echo ""

# GitHub Release via CLI
if command -v gh >/dev/null 2>&1; then
    echo "Check if logged in to GitHub..."
    if ! gh auth status >/dev/null 2>&1; then
        echo "Warning: You are not logged into GitHub CLI. Run 'gh auth login' to enable auto-upload."
        echo "Skipping GitHub release."
        exit 0
    fi

    echo "Creating GitHub Release tag v$VERSION..."
    TAG_NAME="v$VERSION"
    
    # Check if release exists
    if gh release view "$TAG_NAME" >/dev/null 2>&1; then
        echo "Release $TAG_NAME already exists. Uploading zip..."
        gh release upload "$TAG_NAME" "$DIST_DIR/extension-v$VERSION.zip" --clobber
    else
        echo "Creating new release $TAG_NAME..."
        gh release create "$TAG_NAME" "$DIST_DIR/extension-v$VERSION.zip" --title "$TAG_NAME" --notes "Chrome Web Store Release $TAG_NAME"
    fi
else
    echo "gh CLI not found. Skipping auto-upload."
fi
