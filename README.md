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
- **LanceDB** - Embedded vector database (no server needed)
- **Ollama** - Local embeddings with nomic-embed-text (8K context, free)
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

```bash
git clone https://github.com/shtirlitsDva/claude-memory.git
cd claude-memory
./install.sh
```

This installs to a permanent location:
- **Windows:** `%APPDATA%\claude-memory`
- **macOS:** `~/Library/Application Support/claude-memory`
- **Linux:** `~/.local/share/claude-memory`

After installation, you can delete the cloned repo.
</step-2>

<step-3>
**Start the daemon**

```bash
cd "$APPDATA/claude-memory"   # Windows
npm start
```

Or on Linux/macOS:
```bash
cd ~/.local/share/claude-memory   # Linux
cd ~/Library/Application\ Support/claude-memory   # macOS
npm start
```
</step-3>

<step-4>
**Verify**

Start a new Claude Code session. You should see:
```
[Semantic Memory] Active: N memories available
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
</usage>

<configuration>
Edit `config.json` in the install directory:

```json
{
  "port": 8741,
  "embeddingModel": "nomic-embed-text",
  "minSimilarity": 0.35,
  "maxResults": 3,
  "duplicateThreshold": 0.92
}
```
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

This solves "workflow drift" - where memories injected at prompt time become
irrelevant as Claude's task evolves.
</how-it-works>

<credits>
Based on research from:
- [zacdcook/claude-code-semantic-memory](https://github.com/zacdcook/claude-code-semantic-memory)
- PreToolUse hook semantic memory injection pattern
</credits>

<license>
MIT
</license>
