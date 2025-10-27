#!/bin/bash
# Install actionlint if not present and run it on all workflow files

set -e

ACTIONLINT_VERSION="1.7.8"
ACTIONLINT_DIR=".actionlint"
ACTIONLINT_BIN="$ACTIONLINT_DIR/actionlint"

# Create directory if it doesn't exist
mkdir -p "$ACTIONLINT_DIR"

# Check if actionlint is already installed
if [ ! -f "$ACTIONLINT_BIN" ]; then
  echo "📥 Installing actionlint $ACTIONLINT_VERSION..."
  
  # Detect OS and architecture
  OS=$(uname -s | tr '[:upper:]' '[:lower:]')
  ARCH=$(uname -m)
  
  case "$ARCH" in
    x86_64) ARCH="amd64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
  esac
  
  case "$OS" in
    linux) EXT="tar.gz" ;;
    darwin) EXT="tar.gz" ;;
    *) echo "Unsupported OS: $OS"; exit 1 ;;
  esac
  
  DOWNLOAD_URL="https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/actionlint_${ACTIONLINT_VERSION}_${OS}_${ARCH}.${EXT}"
  
  # Download and extract
  curl -sL "$DOWNLOAD_URL" | tar xz -C "$ACTIONLINT_DIR" actionlint
  chmod +x "$ACTIONLINT_BIN"
  
  echo "✅ actionlint installed successfully"
else
  echo "✅ Using existing actionlint installation"
fi

# Run actionlint on all workflow files
echo "🔍 Linting GitHub Actions workflows..."
"$ACTIONLINT_BIN" .github/workflows/*.yml

echo "✅ All workflows passed actionlint checks!"
