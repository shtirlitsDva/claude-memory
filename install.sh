#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Determine install location based on OS
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    # Windows: use AppData
    INSTALL_DIR="$APPDATA/claude-memory"
    INSTALL_DIR_BASH=$(echo "$INSTALL_DIR" | sed 's|\\|/|g' | sed 's|^\([A-Za-z]\):|/\L\1|')
elif [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS: use Application Support
    INSTALL_DIR="$HOME/Library/Application Support/claude-memory"
    INSTALL_DIR_BASH="$INSTALL_DIR"
else
    # Linux: use .local/share
    INSTALL_DIR="$HOME/.local/share/claude-memory"
    INSTALL_DIR_BASH="$INSTALL_DIR"
fi

CLAUDE_DIR="$HOME/.claude"
SETTINGS_FILE="$CLAUDE_DIR/settings.json"

echo "=== Claude Code Semantic Memory Installer ==="
echo ""
echo "Install location: $INSTALL_DIR"
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed."
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check for Ollama
if ! curl -s http://localhost:11434/api/tags &> /dev/null; then
    echo "WARNING: Ollama is not running or not installed."
    echo "Please install Ollama from https://ollama.ai/download"
    echo "Then run: ollama pull nomic-embed-text"
    echo ""
fi

echo "[1/4] Creating install directory..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/hooks"
mkdir -p "$INSTALL_DIR/routes"
mkdir -p "$INSTALL_DIR/services"
mkdir -p "$INSTALL_DIR/data"

echo "[2/4] Copying files..."
cp "$SCRIPT_DIR/package.json" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/package-lock.json" "$INSTALL_DIR/" 2>/dev/null || true
cp "$SCRIPT_DIR/config.json" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/server.js" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/hooks/"*.js "$INSTALL_DIR/hooks/"
cp "$SCRIPT_DIR/routes/"*.js "$INSTALL_DIR/routes/"
cp "$SCRIPT_DIR/services/"*.js "$INSTALL_DIR/services/"

echo "[3/4] Installing dependencies..."
cd "$INSTALL_DIR"
npm install --production

echo "[4/4] Configuring Claude Code hooks..."
mkdir -p "$CLAUDE_DIR"

HOOKS_CONFIG=$(cat <<EOF
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "node $INSTALL_DIR_BASH/hooks/session-start.js",
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
            "command": "node $INSTALL_DIR_BASH/hooks/user-prompt-submit.js",
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
            "command": "node $INSTALL_DIR_BASH/hooks/pre-tool-use.js",
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
    echo "  Merging with existing settings.json..."
    jq -s '.[0] * .[1]' "$SETTINGS_FILE" <(echo "$HOOKS_CONFIG") > "$SETTINGS_FILE.tmp"
    mv "$SETTINGS_FILE.tmp" "$SETTINGS_FILE"
else
    echo "  WARNING: jq not found for JSON merging."
    echo "  Backing up existing settings.json..."
    cp "$SETTINGS_FILE" "$SETTINGS_FILE.backup"

    if grep -q '"hooks"' "$SETTINGS_FILE"; then
        echo "  ERROR: settings.json already has hooks. Please merge manually."
        echo "$HOOKS_CONFIG" > "$INSTALL_DIR/hooks-config.json"
        echo "  Hooks config saved to: $INSTALL_DIR/hooks-config.json"
    else
        # Try to insert hooks before final brace
        node -e "
          const fs = require('fs');
          const existing = JSON.parse(fs.readFileSync('$SETTINGS_FILE', 'utf8'));
          const hooks = $HOOKS_CONFIG;
          Object.assign(existing, hooks);
          fs.writeFileSync('$SETTINGS_FILE', JSON.stringify(existing, null, 2));
        " && echo "  Merged successfully" || echo "  ERROR: Failed to merge. Please merge manually."
    fi
fi

echo ""
echo "=== Installation Complete ==="
echo ""
echo "Installed to: $INSTALL_DIR"
echo ""
echo "You can now delete this git repo if you want."
echo ""
echo "To start the daemon:"
echo "  cd \"$INSTALL_DIR\" && npm start"
echo ""
echo "Or create a shortcut/alias:"
echo "  alias claude-memory='node \"$INSTALL_DIR/server.js\"'"
echo ""
echo "Make sure Ollama is running with nomic-embed-text model:"
echo "  ollama pull nomic-embed-text"
