# Claude Code Semantic Memory

A semantic memory system for Claude Code that injects relevant memories mid-workflow via hooks. Extracts Claude's thinking blocks, embeds them, and queries a vector database for relevant memories — creating a self-correcting Claude workflow.

## Features

- **Mid-workflow memory injection** — PreToolUse hook injects memories based on Claude's current thinking
- **Prompt-time recall** — UserPromptSubmit hook provides context based on user messages
- **Auto-start daemon** — SessionStart hook starts the daemon and shows memory count
- **Transcript export** — PreCompact hook preserves transcripts for learning extraction
- **Local & private** — LanceDB embedded database + Ollama local embeddings
- **Skills included** — `/memories-learn` and `/memories-sanitize` for memory management

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Ollama](https://ollama.ai/download) with `nomic-embed-text` model
- Claude Code CLI

### Installation

```bash
# 1. Install the embedding model
ollama pull nomic-embed-text

# 2. Clone and install
git clone https://github.com/shtirlitsDva/claude-memory.git
cd claude-memory
./install.sh    # Use Git Bash on Windows
```

The installer copies files to:
| OS | Location |
|----|----------|
| Windows | `%APPDATA%\claude-memory` |
| macOS | `~/Library/Application Support/claude-memory` |
| Linux | `~/.local/share/claude-memory` |

Skills are installed to `~/.claude/skills/` and agents to `~/.claude/agents/`.

### Verify

Start a new Claude Code session. You should see:
```
[Semantic Memory] Active: N memories available (model: nomic-embed-text)
```

The daemon auto-starts via the SessionStart hook.

## How It Works

### Memory Injection Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  User sends prompt                                              │
│       ↓                                                         │
│  UserPromptSubmit hook → recalls memories based on prompt       │
│       ↓                                                         │
│  Claude thinks and decides to use a tool                        │
│       ↓                                                         │
│  PreToolUse hook → extracts last 1500 chars of thinking         │
│       ↓              embeds via Ollama                          │
│       ↓              queries LanceDB for top 3 matches          │
│       ↓                                                         │
│  Memories injected → Claude receives them BEFORE tool executes  │
│       ↓                                                         │
│  Claude self-corrects based on recalled memories                │
└─────────────────────────────────────────────────────────────────┘
```

This solves **workflow drift** — memories injected at prompt time become irrelevant as Claude's task evolves. By injecting at tool-use time, memories stay relevant to Claude's current thinking.

### Hooks

| Hook | Trigger | Purpose |
|------|---------|---------|
| SessionStart | New session | Auto-starts daemon, shows memory count |
| UserPromptSubmit | User sends message | Recalls memories relevant to prompt |
| PreToolUse | Before tool execution | Recalls memories based on thinking block |
| PreCompact | Before compaction | Exports transcript for learning extraction |

PreToolUse triggers for: `Read`, `Grep`, `Glob`, `Task`, `WebSearch`, `WebFetch`, `Bash`

## Usage

### Skills

**Extract learnings from your session:**
```
/memories-learn
```
Reads the transcript exported by PreCompact and stores valuable learnings.

**Clean up invalid memories:**
```
/memories-sanitize
```
Reviews all memories and removes invalid, misleading, or outdated ones.

### API Endpoints

```bash
# Store a memory
curl -X POST http://localhost:8741/store \
  -H "Content-Type: application/json" \
  -d '{"type": "GOTCHA", "content": "~ does not expand in settings.json on Windows", "confidence": 0.9}'

# Recall memories
curl -X POST http://localhost:8741/recall \
  -H "Content-Type: application/json" \
  -d '{"query": "settings.json path expansion"}'

# Other endpoints
curl http://localhost:8741/health          # Health check
curl http://localhost:8741/stats           # Statistics
curl http://localhost:8741/list            # List all memories
curl -X DELETE http://localhost:8741/memory/mem_abc123  # Delete
```

### Memory Types

| Type | Use For |
|------|---------|
| `GOTCHA` | Counterintuitive behaviors, traps |
| `WORKING_SOLUTION` | Proven commands/approaches |
| `PATTERN` | Recurring architectural decisions |
| `DECISION` | Design choices with rationale |
| `FAILURE` | What didn't work and why |
| `PREFERENCE` | User-stated requirements |

### Store API Fields

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | One of the types above |
| `content` | Yes | The learning (max 200 chars) |
| `context` | No | Additional context |
| `confidence` | No | Score 0-1 (default: 0.85) |
| `tags` | No | Array of tags |
| `sessionSource` | No | Session ID for tracking |
| `projectPath` | No | Project path for tracking |

## Batch Processing

Process existing transcripts from before you installed this system:

```bash
# Step 1: Convert transcripts to markdown
node scripts/batch-process.js --convert-only

# Step 2: Extract learnings (in a new Claude Code session)
# Paste the prompt from prompts/extract-learnings.md

# Step 3: Import to database
node scripts/batch-process.js --import ~/extracted-learnings.jsonl
```

## Configuration

Edit `config.json` in the install directory:

```json
{
  "port": 8741,
  "embeddingModel": "nomic-embed-text",
  "embeddingDims": 768,
  "ollamaUrl": "http://localhost:11434",
  "minSimilarity": 0.35,
  "maxResults": 3,
  "duplicateThreshold": 0.92,
  "timeoutMs": 10000,
  "maxContentLength": 200,
  "autoStart": true
}
```

| Setting | Description |
|---------|-------------|
| `minSimilarity` | Minimum similarity threshold for recall (0-1) |
| `maxResults` | Maximum memories returned per query |
| `duplicateThreshold` | Similarity above which new memories are rejected as duplicates |
| `maxContentLength` | Maximum characters for memory content |
| `autoStart` | Auto-start daemon from SessionStart hook |

## Project Structure

```
claude-memory/
├── server.js                 # Express daemon with LanceDB
├── config.json               # Configuration
├── install.sh / uninstall.sh # Installation scripts
├── hooks/
│   ├── session-start.js      # Auto-start, memory count
│   ├── user-prompt-submit.js # Prompt-time recall
│   ├── pre-tool-use.js       # Thinking-based recall
│   └── pre-compact.js        # Transcript export
├── routes/                   # API endpoints
├── services/
│   ├── embeddings.js         # Ollama with request queue
│   └── vector-db.js          # LanceDB operations
├── scripts/                  # Batch processing tools
├── prompts/                  # Extraction prompts
├── skills/                   # /memories-learn, /memories-sanitize
└── agents/                   # memory-extractor agent
```

## Uninstall

```bash
./uninstall.sh

# Or manually:
rm -rf "$APPDATA/claude-memory"              # Windows
rm -rf ~/.local/share/claude-memory          # Linux
rm -rf ~/.claude/skills/memories-*
rm -rf ~/.claude/agents/memory-extractor.md
# Remove "hooks" section from ~/.claude/settings.json
```

## Credits

Based on [zacdcook/claude-code-semantic-memory](https://github.com/zacdcook/claude-code-semantic-memory) and the PreToolUse hook semantic memory injection pattern.

## License

MIT
