<header>
Claude Code Semantic Memory System
</header>

A semantic memory system for Claude Code that injects relevant memories mid-workflow via hooks.
Extracts Claude's thinking blocks, embeds them, and queries a vector database for relevant memories -
creating a "self-correcting Claude workflow."

<features>
- **PreToolUse hook** - Injects memories based on Claude's current thinking (mid-workflow correction)
- **UserPromptSubmit hook** - Injects memories based on user's prompt
- **SessionStart hook** - Auto-starts daemon, shows memory count
- **PreCompact hook** - Exports transcripts before compaction for learning extraction
- **LanceDB** - Embedded vector database (no server needed)
- **Ollama** - Local embeddings with nomic-embed-text (768 dims, free)
- **Skills** - `/memories-learn` and `/memories-sanitize` for memory management
- **Batch processing** - Convert and extract learnings from existing transcripts
</features>

<prerequisites>
1. **Node.js** 18+ - https://nodejs.org/
2. **Ollama** - https://ollama.ai/download
3. **Claude Code CLI**
</prerequisites>

<installation>
<step-1>
**Install Ollama and pull the embedding model**

Download Ollama from https://ollama.ai/download

Then pull the embedding model:
```bash
ollama pull nomic-embed-text
```
</step-1>

<step-2>
**Clone and install**

**Windows (Git Bash):**
```bash
git clone https://github.com/shtirlitsDva/claude-memory.git
cd claude-memory
./install.sh
```

**Linux / macOS (Terminal):**
```bash
git clone https://github.com/shtirlitsDva/claude-memory.git
cd claude-memory
chmod +x install.sh
./install.sh
```

> **Note:** On Windows, use Git Bash (comes with Git for Windows), not PowerShell or CMD.

This installs to a permanent location:
- **Windows:** `%APPDATA%\claude-memory`
- **macOS:** `~/Library/Application Support/claude-memory`
- **Linux:** `~/.local/share/claude-memory`

The installer also copies skills to `~/.claude/skills/` and agents to `~/.claude/agents/`.

After installation, you can delete the cloned repo.
</step-2>

<step-3>
**Start the daemon**

**Windows (Git Bash or CMD/PowerShell):**
```bash
cd "%APPDATA%\claude-memory"
npm start
```

**Linux:**
```bash
cd ~/.local/share/claude-memory
npm start
```

**macOS:**
```bash
cd ~/Library/Application\ Support/claude-memory
npm start
```

The daemon also auto-starts when you open a Claude Code session (via SessionStart hook).
</step-3>

<step-4>
**Verify**

Start a new Claude Code session. You should see:
```
[Semantic Memory] Active: N memories available (model: nomic-embed-text)
```
</step-4>
</installation>

<uninstall>
```bash
# From the cloned repo directory:
./uninstall.sh

# Or manually:
rm -rf "$APPDATA/claude-memory"  # Windows
rm -rf ~/.local/share/claude-memory  # Linux
rm -rf ~/.claude/skills/memories-learn
rm -rf ~/.claude/skills/memories-sanitize
rm -rf ~/.claude/agents/memory-extractor.md
# Then remove "hooks" section from ~/.claude/settings.json
```
</uninstall>

<usage>
<storing-memories>
```bash
curl -X POST http://localhost:8741/store \
  -H "Content-Type: application/json" \
  -d '{
    "type": "GOTCHA",
    "content": "Environment variable ~ does not expand in settings.json on Windows",
    "context": "Claude Code configuration",
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

**Fields:**
- `type` (required) - One of the types above
- `content` (required) - The learning (max 200 chars by default)
- `context` (optional) - Additional context
- `tags` (optional) - Array of tags
- `confidence` (optional) - Score 0-1 (default: 0.85)
- `sessionSource` (optional) - Session ID for tracking
- `projectPath` (optional) - Project path for tracking
</storing-memories>

<querying-memories>
```bash
curl -X POST http://localhost:8741/recall \
  -H "Content-Type: application/json" \
  -d '{"query": "settings.json path expansion"}'
```
</querying-memories>

<other-endpoints>
```bash
# Health check
curl http://localhost:8741/health

# Statistics
curl http://localhost:8741/stats

# List all memories
curl http://localhost:8741/list

# Delete a memory
curl -X DELETE http://localhost:8741/memory/mem_abc123
```
</other-endpoints>

<skills>
**`/memories-learn`** - Extract learnings from the latest session transcript

Run this command in Claude Code after a productive session to extract and store learnings:
```
/memories-learn
```

This reads the transcript exported by the PreCompact hook and stores valuable learnings.

**`/memories-sanitize`** - Review and clean up invalid memories

Run this to review all memories and remove invalid, misleading, or outdated ones:
```
/memories-sanitize
```
</skills>

<batch-processing>
For processing existing transcripts from before you installed this system:

**Step 1: Convert transcripts to markdown**
```bash
node scripts/batch-process.js --convert-only
# Or specify custom directories:
node scripts/batch-process.js --convert-only --projects ~/.claude/projects --output ./converted
```

**Step 2: Extract learnings**

Open a new Claude Code session and paste the prompt from `prompts/extract-learnings.md`.
This will process your converted transcripts and output to `~/extracted-learnings.jsonl`.

**Step 3: Import to database**
```bash
node scripts/batch-process.js --import ~/extracted-learnings.jsonl
```
</batch-processing>
</usage>

<hooks>
Four hooks are installed to `~/.claude/settings.json`:

| Hook | Trigger | Purpose |
|------|---------|---------|
| `SessionStart` | New session | Auto-starts daemon, shows memory count |
| `UserPromptSubmit` | User sends message | Recalls memories relevant to user's prompt |
| `PreToolUse` | Before tool execution | Recalls memories based on Claude's thinking block |
| `PreCompact` | Before context compaction | Exports transcript for later learning extraction |

The `PreToolUse` hook only triggers for: Read, Grep, Glob, Task, WebSearch, WebFetch, Bash.
</hooks>

<configuration>
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
| `port` | Daemon HTTP port |
| `embeddingModel` | Ollama model for embeddings |
| `embeddingDims` | Embedding vector dimensions |
| `ollamaUrl` | Ollama API endpoint |
| `minSimilarity` | Minimum similarity threshold for recall |
| `maxResults` | Maximum memories returned per query |
| `duplicateThreshold` | Similarity threshold for duplicate detection |
| `timeoutMs` | Ollama request timeout |
| `maxContentLength` | Maximum characters for memory content |
| `autoStart` | Auto-start daemon from SessionStart hook |
</configuration>

<how-it-works>
The **PreToolUse hook** fires before every tool call:

1. Claude decides to use a tool (Read, Grep, Bash, etc.)
2. Hook extracts last 1500 chars from Claude's thinking block
3. Hook embeds the text via Ollama
4. Hook queries LanceDB for top 3 relevant memories
5. Memories injected as XML in `additionalContext`
6. Claude receives memories BEFORE executing the tool
7. Claude can self-correct based on injected memories

The **UserPromptSubmit hook** provides memories at prompt time based on the user's message.

The **PreCompact hook** exports transcripts before compaction, preserving them for later learning extraction via `/memories-learn`.

This solves "workflow drift" - where memories injected at prompt time become irrelevant as Claude's task evolves.
</how-it-works>

<project-structure>
```
claude-memory/
├── server.js              # Express daemon with LanceDB
├── config.json            # Configuration
├── package.json           # Dependencies
├── install.sh             # Installation script
├── uninstall.sh           # Uninstallation script
├── hooks/
│   ├── session-start.js   # SessionStart hook
│   ├── user-prompt-submit.js  # UserPromptSubmit hook
│   ├── pre-tool-use.js    # PreToolUse hook
│   └── pre-compact.js     # PreCompact hook
├── routes/
│   ├── store.js           # POST /store
│   ├── recall.js          # POST /recall
│   ├── health.js          # GET /health
│   ├── stats.js           # GET /stats
│   ├── list.js            # GET /list
│   └── delete.js          # DELETE /memory/:id
├── services/
│   ├── embeddings.js      # Ollama embedding service with request queue
│   └── vector-db.js       # LanceDB operations
├── scripts/
│   ├── batch-process.js   # Orchestrates transcript conversion and import
│   ├── jsonl-to-markdown.js   # Converts JSONL to readable markdown
│   └── import-learnings.js    # Imports extracted learnings
├── prompts/
│   ├── extract-learnings.md   # Batch extraction prompt
│   └── extract-task.md       # Individual extraction template
├── skills/
│   ├── memories-learn/    # /memories-learn skill
│   └── memories-sanitize/ # /memories-sanitize skill
└── agents/
    └── memory-extractor.md    # Haiku agent for extraction
```
</project-structure>

<credits>
Based on research from:
- [zacdcook/claude-code-semantic-memory](https://github.com/zacdcook/claude-code-semantic-memory)
- PreToolUse hook semantic memory injection pattern
</credits>

<license>
MIT
</license>
