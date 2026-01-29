#!/usr/bin/env node
const http = require('http');

const CONFIG = {
  host: process.env.CLAUDE_DAEMON_HOST || 'localhost',
  port: process.env.CLAUDE_DAEMON_PORT || 8741,
  minSimilarity: 0.45,
  maxResults: 3
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

  const lines = ['<recalled-memories source="user-prompt">'];
  for (const mem of memories) {
    lines.push(`  <memory type="${mem.type}" similarity="${mem.similarity.toFixed(2)}">`);
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

  const prompt = input.prompt;
  if (!prompt || prompt.length < 10) {
    process.exit(0);
  }

  const result = await recallMemories(prompt);

  if (result.memories && result.memories.length > 0) {
    const similarity = result.memories.map(m => m.similarity.toFixed(2)).join('-');
    const output = {
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: `[Recalled ${result.memories.length} memories | similarity: ${similarity}]\n${formatMemories(result.memories)}`
      }
    };
    console.log(JSON.stringify(output));
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
