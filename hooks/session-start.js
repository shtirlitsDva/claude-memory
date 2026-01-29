#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const CONFIG = {
  host: process.env.CLAUDE_DAEMON_HOST || 'localhost',
  port: process.env.CLAUDE_DAEMON_PORT || 8741,
  autoStart: process.env.CLAUDE_DAEMON_AUTOSTART !== 'false',
  daemonDir: process.env.CLAUDE_DAEMON_DIR || path.resolve(__dirname, '..'),
  transcriptsDir: path.join(os.homedir(), '.claude', 'transcripts')
};

const DAEMON_URL = `http://${CONFIG.host}:${CONFIG.port}`;

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    let resolved = false;
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => {
      if (!resolved) {
        resolved = true;
        resolve(data);
      }
    });
    setTimeout(() => {
      if (!resolved && data) {
        resolved = true;
        resolve(data);
      }
    }, 500);
  });
}

function healthCheck() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: CONFIG.host,
      port: CONFIG.port,
      path: '/health',
      method: 'GET',
      timeout: 500
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

async function startDaemon() {
  const serverPath = path.join(CONFIG.daemonDir, 'server.js');

  try {
    const child = spawn('node', [serverPath], {
      detached: true,
      stdio: 'ignore',
      cwd: CONFIG.daemonDir,
      windowsHide: true
    });
    child.unref();

    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 300));
      const health = await healthCheck();
      if (health) return health;
    }
  } catch (e) {
    console.error(`[memory] Failed to start daemon: ${e.message}`);
  }
  return null;
}

function getExtractionInstructions(metadata) {
  return `
<learning-extraction-required>
Session transcript was exported before compaction and needs learning extraction.

TRANSCRIPT: ${metadata.transcript_path}
SESSION: ${metadata.session_id}
DAEMON: ${metadata.daemon_url}

You MUST dispatch a sub-agent using the Task tool with this prompt:

---
Read the transcript at ${metadata.transcript_path} and extract learnings to store in the semantic memory database.

For each learning found, store it by running:
curl -X POST ${metadata.daemon_url}/store -H "Content-Type: application/json" -d '{"type": "<TYPE>", "content": "<LEARNING>", "context": "<CONTEXT>", "confidence": <SCORE>, "sessionSource": "${metadata.session_id}"}'

LEARNING TYPES:
- WORKING_SOLUTION: Commands, code, or approaches that worked
- GOTCHA: Traps, counterintuitive behaviors, "watch out for this"
- PATTERN: Recurring architectural decisions or workflows
- DECISION: Explicit design choices with reasoning
- FAILURE: What didn't work and why
- PREFERENCE: User's stated preferences

RULES:
- Be specific - include actual commands, paths, error messages
- Confidence 0.95+ for explicitly confirmed, 0.85+ for strong evidence
- Skip generic programming knowledge Claude already knows
- Focus on user-specific infrastructure, preferences, workflows
- Keep content under 200 characters, use context for details
---
</learning-extraction-required>
`;
}

async function main() {
  const inputData = await readStdin();
  let input = {};
  try {
    input = JSON.parse(inputData);
  } catch {}

  let health = await healthCheck();

  if (!health && CONFIG.autoStart && CONFIG.host === 'localhost') {
    console.error('[memory] Daemon not running, attempting to start...');
    health = await startDaemon();
  }

  let additionalContext = '';

  if (health) {
    additionalContext = `[Semantic Memory] Active: ${health.memoryCount} memories available (model: ${health.embeddingModel})`;
  } else {
    console.error(`[memory] Daemon unavailable. Start it with: cd ${CONFIG.daemonDir} && node server.js`);
  }

  if (input.source === 'compact') {
    const latestPath = path.join(CONFIG.transcriptsDir, 'latest.json');
    if (fs.existsSync(latestPath)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
        if (metadata.status === 'pending_extraction') {
          additionalContext += '\n\n' + getExtractionInstructions(metadata);
          metadata.status = 'extraction_requested';
          fs.writeFileSync(latestPath, JSON.stringify(metadata, null, 2));
        }
      } catch (e) {
        console.error(`[memory] Failed to read extraction metadata: ${e.message}`);
      }
    }
  }

  if (additionalContext) {
    const output = {
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: additionalContext.trim()
      }
    };
    console.log(JSON.stringify(output));
  }
}

main().catch(e => {
  console.error(`[memory] Error: ${e.message}`);
});
