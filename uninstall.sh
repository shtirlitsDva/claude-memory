#!/bin/bash

CLAUDE_DIR="$HOME/.claude"
HOOKS_DIR="$CLAUDE_DIR/hooks"
SETTINGS_FILE="$CLAUDE_DIR/settings.json"

echo "=== Claude Code Semantic Memory Uninstaller ==="
echo ""

echo "[1/3] Removing hooks..."
rm -f "$HOOKS_DIR/session-start.js"
rm -f "$HOOKS_DIR/user-prompt-submit.js"
rm -f "$HOOKS_DIR/pre-tool-use.js"
echo "  Removed hook files"

echo ""
echo "[2/3] Cleaning up settings.json..."
echo "  NOTE: You need to manually remove the 'hooks' section from:"
echo "  $SETTINGS_FILE"

echo ""
echo "[3/3] Stopping daemon (if running)..."
pkill -f "node.*server.js" 2>/dev/null || true
echo "  Done"

echo ""
echo "=== Uninstall Complete ==="
echo ""
echo "The daemon directory and data were NOT removed."
echo "To fully remove, delete this directory manually."
echo ""
echo "To remove hooks config, edit $SETTINGS_FILE"
echo "and remove the 'hooks' section."
