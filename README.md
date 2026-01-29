<header>
Claude Code Semantic Memory System
</header>

A semantic memory system for Claude Code that injects relevant memories mid-workflow via hooks.
Based on the PreToolUse hook pattern that extracts Claude's thinking blocks, embeds them, and queries
a vector database for relevant memories - creating a "self-correcting Claude workflow."

<features>
- **PreToolUse hook** - Injects memories based on Claude's current thinking (mid-workflow correction)
- **UserPromptSubmit hook** - Injects memories based on user's prompt
- **SessionStart hook** - Auto-starts daemon, shows memory count
- **LanceDB** - Embedded vector database (no server needed)
- **Ollama** - Local embeddings with nomic-embed-text (8K context, free)
- **Duplicate detection** - Prevents storing similar memories (0.92 threshold)
</features>

<architecture>
```
┌─────────────────────────────────────────────────────────────────────┐
│                         MEMORY DAEMON                                │
│                      (Node.js HTTP Server)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────┐ │
│  │   /store     │  │   /recall    │  │   /health, /stats, /list   │ │
│  └──────────────┘  └──────────────┘  └────────────────────────────┘ │
│                              │                                       │
│                    LanceDB + Ollama Embeddings                       │
└─────────────────────────────────────────────────────────────────────┘
                              ▲
                              │ HTTP (localhost:8741)
┌─────────────────────────────┼───────────────────────────────────────┐
│                     CLAUDE CODE HOOKS                                │
│  ┌──────────────────┐  ┌───┴───────────────┐  ┌──────────────────┐  │
│  │ session-start.js │  │ pre-tool-use.js   │  │user-prompt-sub.js│  │
│  │  (health check)  │  │ (thinking block)  │  │  (user prompt)   │  │
│  └──────────────────┘  └───────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```
</architecture>

<prerequisites>
1. **Node.js** 18+ (for daemon)
2. **Ollama** with nomic-embed-text model
3. **Claude Code CLI**
</prerequisites>

<installation>
<step-1>
**Install Ollama**

Download from https://ollama.ai/download

After installation, pull the embedding model:
```bash
ollama pull nomic-embed-text
```

Verify it works:
```bash
curl http://localhost:11434/api/embeddings -d '{"model":"nomic-embed-text","prompt":"test"}'
```
</step-1>

<step-2>
**Clone this repository**

```bash
git clone https://github.com/shtirlitsDva/claude-memory.git
cd claude-memory
```
</step-2>

<step-3>
**Run the install script**

Windows (Git Bash) / Linux / macOS:
```bash
./install.sh
```

This will:
- Install npm dependencies
- Configure ~/.claude/settings.json to use hooks from THIS repo location
- No files are copied - the repo is self-contained
</step-3>

<step-4>
**Start the daemon**

```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```
</step-4>

<step-5>
**Verify installation**

```bash
# Health check
curl http://localhost:8741/health

# Store a test memory
curl -X POST http://localhost:8741/store \
  -H "Content-Type: application/json" \
  -d '{"type":"GOTCHA","content":"Test memory"}'

# Query it
curl -X POST http://localhost:8741/recall \
  -H "Content-Type: application/json" \
  -d '{"query":"test"}'
```

Start a new Claude Code session - you should see:
```
[Semantic Memory] Active: N memories available
```
</step-5>
</installation>

<manual-installation>
If the install script doesn't work, follow these steps:

1. **Install dependencies**
```bash
cd claude-memory
npm install
```

2. **Update settings.json**

Add hooks to your `~/.claude/settings.json`, pointing to the repo location.

**Windows example** (repo at `C:\Projects\claude-memory`):
```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [{ "type": "command", "command": "node /c/Projects/claude-memory/hooks/session-start.js", "timeout": 5000 }]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [{ "type": "command", "command": "node /c/Projects/claude-memory/hooks/user-prompt-submit.js", "timeout": 3000 }]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Read|Grep|Glob|Task|WebSearch|WebFetch|Bash",
        "hooks": [{ "type": "command", "command": "node /c/Projects/claude-memory/hooks/pre-tool-use.js", "timeout": 3000 }]
      }
    ]
  }
}
```

**Linux/macOS example** (repo at `/home/user/claude-memory`):
```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [{ "type": "command", "command": "node /home/user/claude-memory/hooks/session-start.js", "timeout": 5000 }]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [{ "type": "command", "command": "node /home/user/claude-memory/hooks/user-prompt-submit.js", "timeout": 3000 }]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Read|Grep|Glob|Task|WebSearch|WebFetch|Bash",
        "hooks": [{ "type": "command", "command": "node /home/user/claude-memory/hooks/pre-tool-use.js", "timeout": 3000 }]
      }
    ]
  }
}
```

**Path format:** On Windows, use Git Bash style paths (`/c/...` not `C:\...`).
</manual-installation>

<usage>
<storing-memories>
```bash
curl -X POST http://localhost:8741/store \
  -H "Content-Type: application/json" \
  -d '{
    "type": "GOTCHA",
    "content": "Environment variable ~ does not expand in settings.json on Windows",
    "context": "Windows Git Bash Claude Code",
    "confidence": 0.9
  }'
```

**Memory types:**
- `GOTCHA` - Counterintuitive behaviors, traps
- `WORKING_SOLUTION` - Proven commands/approaches
- `PATTERN` - Recurring architectural decisions
- `DECISION` - Design choices with rationale
- `FAILURE` - What didn't work and why
- `PREFERENCE` - User-stated requirements
</storing-memories>

<querying-memories>
```bash
curl -X POST http://localhost:8741/recall \
  -H "Content-Type: application/json" \
  -d '{"query": "settings.json path expansion"}'
```
</querying-memories>

<listing-memories>
```bash
curl http://localhost:8741/list
curl "http://localhost:8741/list?type=GOTCHA&limit=10"
```
</listing-memories>

<deleting-memories>
```bash
curl -X DELETE http://localhost:8741/memory/mem_abc123
```
</deleting-memories>
</usage>

<api-reference>
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check, memory count |
| `/stats` | GET | Statistics by type |
| `/store` | POST | Store a new memory |
| `/recall` | POST | Query for relevant memories |
| `/list` | GET | List all memories |
| `/memory/:id` | DELETE | Delete a memory |
</api-reference>

<configuration>
Edit `config.json`:

```json
{
  "port": 8741,
  "embeddingModel": "nomic-embed-text",
  "embeddingDims": 768,
  "ollamaUrl": "http://localhost:11434",
  "minSimilarity": 0.35,
  "maxResults": 3,
  "duplicateThreshold": 0.92,
  "timeoutMs": 2500,
  "maxContentLength": 200
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `port` | 8741 | Daemon HTTP port |
| `embeddingModel` | nomic-embed-text | Ollama model for embeddings |
| `minSimilarity` | 0.35 | Minimum similarity for recall |
| `maxResults` | 3 | Max memories returned per query |
| `duplicateThreshold` | 0.92 | Threshold for duplicate detection |
</configuration>

<how-it-works>
The key innovation is the **PreToolUse hook** that fires before every tool call:

1. Claude decides to use a tool (Read, Grep, Bash, etc.)
2. PreToolUse hook extracts last 1500 chars from Claude's thinking block
3. Hook embeds the thinking text via Ollama
4. Hook queries LanceDB for top 3 relevant memories (≥0.35 similarity)
5. Memories are injected as XML in `additionalContext`
6. Claude receives memories BEFORE executing the tool
7. Claude can self-correct based on injected memories

This solves "workflow drift" - where memories injected at prompt time become irrelevant as Claude's task evolves.
</how-it-works>

<credits>
Based on:
- [zacdcook/claude-code-semantic-memory](https://github.com/zacdcook/claude-code-semantic-memory)
- Research on PreToolUse hook semantic memory injection
- LanceDB for embedded vector storage
- Ollama for local embeddings
</credits>

<license>
MIT
</license>
