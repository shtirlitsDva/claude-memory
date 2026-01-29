#!/bin/bash

# Determine install location based on OS
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    INSTALL_DIR="$APPDATA/claude-memory"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    INSTALL_DIR="$HOME/Library/Application Support/claude-memory"
else
    INSTALL_DIR="$HOME/.local/share/claude-memory"
fi

SETTINGS_FILE="$HOME/.claude/settings.json"

echo "=== Claude Code Semantic Memory Uninstaller ==="
echo ""

echo "[1/3] Stopping daemon if running..."
pkill -f "node.*claude-memory.*server.js" 2>/dev/null || true

echo "[2/3] Removing installed files..."
if [ -d "$INSTALL_DIR" ]; then
    rm -rf "$INSTALL_DIR"
    echo "  Removed: $INSTALL_DIR"
else
    echo "  Not found: $INSTALL_DIR"
fi

echo "[3/3] Cleaning settings.json..."
if [ -f "$SETTINGS_FILE" ]; then
    if command -v jq &> /dev/null; then
        jq 'del(.hooks)' "$SETTINGS_FILE" > "$SETTINGS_FILE.tmp"
        mv "$SETTINGS_FILE.tmp" "$SETTINGS_FILE"
        echo "  Removed hooks from settings.json"
    else
        echo "  WARNING: jq not found. Please manually remove 'hooks' section from:"
        echo "  $SETTINGS_FILE"
    fi
fi

echo ""
echo "=== Uninstall Complete ==="
echo ""
echo "Memory data was stored in: $INSTALL_DIR/data/"
echo "(Already deleted above)"
