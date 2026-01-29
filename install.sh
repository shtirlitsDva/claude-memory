#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
SETTINGS_FILE="$CLAUDE_DIR/settings.json"

echo "=== Claude Code Semantic Memory Installer ==="
echo ""
echo "Repo location: $SCRIPT_DIR"
echo ""

# Convert to Git Bash style path for Windows
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    REPO_PATH=$(echo "$SCRIPT_DIR" | sed 's|\\|/|g' | sed 's|^\([A-Za-z]\):|/\L\1|')
else
    REPO_PATH="$SCRIPT_DIR"
fi

echo "[1/3] Installing npm dependencies..."
cd "$SCRIPT_DIR"
npm install

echo ""
echo "[2/3] Creating Claude config directory..."
mkdir -p "$CLAUDE_DIR"

echo ""
echo "[3/3] Configuring Claude Code hooks..."

# Create hooks configuration pointing to THIS repo
HOOKS_CONFIG=$(cat <<EOF
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "node $REPO_PATH/hooks/session-start.js",
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
            "command": "node $REPO_PATH/hooks/user-prompt-submit.js",
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
            "command": "node $REPO_PATH/hooks/pre-tool-use.js",
            "timeout": 3000
          }
        ]
      }
    ]
  }
}
EOF
)

if [ ! -f "$SETTINGS_FILE" ]; then
    echo "$HOOKS_CONFIG" > "$SETTINGS_FILE"
    echo "  Created new settings.json"
elif command -v jq &> /dev/null; then
    echo "  Merging with existing settings.json using jq..."
    EXISTING=$(cat "$SETTINGS_FILE")
    echo "$EXISTING" | jq -s ".[0] * $HOOKS_CONFIG" > "$SETTINGS_FILE.tmp"
    mv "$SETTINGS_FILE.tmp" "$SETTINGS_FILE"
else
    echo "  WARNING: jq not found. Creating backup and adding hooks..."
    cp "$SETTINGS_FILE" "$SETTINGS_FILE.backup.$(date +%s)"

    # Simple merge: if file has content, try to insert hooks before last }
    if grep -q '"hooks"' "$SETTINGS_FILE"; then
        echo "  ERROR: settings.json already has hooks section."
        echo "  Please manually merge from: $SCRIPT_DIR/settings-hooks.json"
        echo "$HOOKS_CONFIG" > "$SCRIPT_DIR/settings-hooks.json"
        exit 1
    else
        # Insert hooks config before the final }
        sed -i '$ d' "$SETTINGS_FILE"  # Remove last line (closing brace)
        echo '  ,"hooks": {' >> "$SETTINGS_FILE"
        echo "$HOOKS_CONFIG" | grep -A 100 '"hooks":' | tail -n +2 | head -n -1 >> "$SETTINGS_FILE"
        echo '}' >> "$SETTINGS_FILE"
    fi
fi

echo ""
echo "=== Installation Complete ==="
echo ""
echo "Hooks configured to run from: $REPO_PATH"
echo ""
echo "Next steps:"
echo ""
echo "1. Install Ollama (if not installed):"
echo "   Download from https://ollama.ai/download"
echo "   Then run: ollama pull nomic-embed-text"
echo ""
echo "2. Start the daemon:"
echo "   cd \"$SCRIPT_DIR\""
echo "   npm start"
echo ""
echo "3. Start a new Claude Code session"
echo "   You should see: [Semantic Memory] Active"
