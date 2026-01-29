#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
HOOKS_DIR="$CLAUDE_DIR/hooks"
SETTINGS_FILE="$CLAUDE_DIR/settings.json"

echo "=== Claude Code Semantic Memory Installer ==="
echo ""

# Convert Windows path to Git Bash style if needed
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    SCRIPT_DIR_BASH=$(echo "$SCRIPT_DIR" | sed 's|\\|/|g' | sed 's|^\([A-Za-z]\):|/\L\1|')
else
    SCRIPT_DIR_BASH="$SCRIPT_DIR"
fi

echo "[1/5] Installing npm dependencies..."
cd "$SCRIPT_DIR"
npm install

echo ""
echo "[2/5] Creating hooks directory..."
mkdir -p "$HOOKS_DIR"

echo ""
echo "[3/5] Copying hooks..."
cp "$SCRIPT_DIR/hooks/"*.js "$HOOKS_DIR/"
echo "  Copied: session-start.js, user-prompt-submit.js, pre-tool-use.js"

echo ""
echo "[4/5] Updating hooks to use repo path..."
# Update the daemon directory in session-start.js
sed -i "s|path.join(process.env.HOME || process.env.USERPROFILE, '.claude', 'memory-daemon')|'$SCRIPT_DIR_BASH'|g" "$HOOKS_DIR/session-start.js" 2>/dev/null || true

echo ""
echo "[5/5] Configuring Claude Code settings..."

# Create settings.json if it doesn't exist
if [ ! -f "$SETTINGS_FILE" ]; then
    echo '{}' > "$SETTINGS_FILE"
fi

# Create the hooks configuration
HOOKS_CONFIG=$(cat <<EOF
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "node $SCRIPT_DIR_BASH/hooks/session-start.js",
            "timeout": 5000
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node $SCRIPT_DIR_BASH/hooks/user-prompt-submit.js",
            "timeout": 3000
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Read|Grep|Glob|Task|WebSearch|WebFetch|Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node $SCRIPT_DIR_BASH/hooks/pre-tool-use.js",
            "timeout": 3000
          }
        ]
      }
    ]
  }
}
EOF
)

# Check if jq is available for JSON merging
if command -v jq &> /dev/null; then
    echo "  Using jq to merge settings..."
    EXISTING=$(cat "$SETTINGS_FILE")
    echo "$EXISTING" | jq -s '.[0] * '"$HOOKS_CONFIG" > "$SETTINGS_FILE.tmp"
    mv "$SETTINGS_FILE.tmp" "$SETTINGS_FILE"
else
    echo "  jq not found, creating backup and writing new settings..."
    if [ -f "$SETTINGS_FILE" ] && [ -s "$SETTINGS_FILE" ]; then
        cp "$SETTINGS_FILE" "$SETTINGS_FILE.backup"
        echo "  Backup created: $SETTINGS_FILE.backup"
        echo "  WARNING: Please manually merge hooks from the new settings.json"
    fi
    echo "$HOOKS_CONFIG" > "$SETTINGS_FILE"
fi

echo ""
echo "=== Installation Complete ==="
echo ""
echo "Next steps:"
echo "1. Make sure Ollama is running with nomic-embed-text:"
echo "   ollama pull nomic-embed-text"
echo ""
echo "2. Start the daemon:"
echo "   cd $SCRIPT_DIR && npm start"
echo ""
echo "3. Start a new Claude Code session to verify:"
echo "   You should see: [Semantic Memory] Active: N memories available"
echo ""
echo "Daemon directory: $SCRIPT_DIR_BASH"
echo "Hooks directory:  $HOOKS_DIR"
echo "Settings file:    $SETTINGS_FILE"
