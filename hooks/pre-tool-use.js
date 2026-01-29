#!/usr/bin/env node
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG = {
  host: process.env.CLAUDE_DAEMON_HOST || 'localhost',
  port: process.env.CLAUDE_DAEMON_PORT || 8741,
  thinkingChars: 1500,
  minSimilarity: 0.35,
  maxResults: 3,
  hashCachePath: path.join(os.tmpdir(), 'claude-memory-hash-cache.json'),
  enabledTools: ['Read', 'Grep', 'Glob', 'Task', 'WebSearch', 'WebFetch', 'Bash']
};

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
    setTimeout(() => resolve(data), 100);
  });
}

function extractThinking(transcriptPath) {
  try {
    if (!fs.existsSync(transcriptPath)) {
      return null;
    }

    const content = fs.readFileSync(transcriptPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const msg = JSON.parse(lines[i]);
        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block.type === 'thinking' && block.thinking) {
              const text = block.thinking;
              return text.slice(-CONFIG.thinkingChars);
            }
          }
        }
      } catch {}
    }
  } catch (e) {
    console.error(`[memory] Failed to read transcript: ${e.message}`);
  }
  return null;
}

function hashText(text) {
  return crypto.createHash('md5').update(text).digest('hex');
}

function isDuplicateQuery(hash) {
  try {
    if (fs.existsSync(CONFIG.hashCachePath)) {
      const cache = JSON.parse(fs.readFileSync(CONFIG.hashCachePath, 'utf-8'));
      if (cache.lastHash === hash && (Date.now() - cache.timestamp) < 60000) {
        return true;
      }
    }
  } catch {}
  return false;
}

function saveHash(hash) {
  try {
    fs.writeFileSync(CONFIG.hashCachePath, JSON.stringify({
      lastHash: hash,
      timestamp: Date.now()
    }));
  } catch {}
}

function recallMemories(query) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      query,
      minSimilarity: CONFIG.minSimilarity,
      maxResults: CONFIG.maxResults
    });

    const req = http.request({
      hostname: CONFIG.host,
      port: CONFIG.port,
      path: '/recall',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 2000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ memories: [] });
        }
      });
    });

    req.on('error', () => resolve({ memories: [] }));
    req.on('timeout', () => { req.destroy(); resolve({ memories: [] }); });
    req.write(payload);
    req.end();
  });
}

function formatMemories(memories) {
  if (!memories || memories.length === 0) return '';

  const lines = ['<recalled-memories source="thinking-block">'];
  for (const mem of memories) {
    const similarity = mem.similarity.toFixed(2);
    lines.push(`  <memory type="${mem.type}" similarity="${similarity}">`);
    lines.push(`    ${mem.content}`);
    lines.push(`  </memory>`);
  }
  lines.push('</recalled-memories>');

  return lines.join('\n');
}

async function main() {
  const stdinData = await readStdin();

  let input;
  try {
    input = JSON.parse(stdinData);
  } catch {
    process.exit(0);
  }

  const toolName = input.tool_name;

  if (!CONFIG.enabledTools.includes(toolName)) {
    process.exit(0);
  }

  const transcriptPath = input.transcript_path;
  if (!transcriptPath) {
    process.exit(0);
  }

  const thinking = extractThinking(transcriptPath);
  if (!thinking || thinking.length < 50) {
    process.exit(0);
  }

  const hash = hashText(thinking);
  if (isDuplicateQuery(hash)) {
    process.exit(0);
  }

  const result = await recallMemories(thinking);

  if (result.memories && result.memories.length > 0) {
    saveHash(hash);

    const context = formatMemories(result.memories);
    const similarity = result.memories.map(m => m.similarity.toFixed(2)).join('-');

    const output = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: `[Recalled ${result.memories.length} memories | similarity: ${similarity}]\n${context}`
      }
    };

    console.log(JSON.stringify(output));
  }

  process.exit(0);
}

main().catch(e => {
  console.error(`[memory] Error: ${e.message}`);
  process.exit(0);
});
