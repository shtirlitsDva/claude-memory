#!/usr/bin/env node
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const CONFIG = {
  host: process.env.CLAUDE_DAEMON_HOST || 'localhost',
  port: process.env.CLAUDE_DAEMON_PORT || 8741,
  autoStart: process.env.CLAUDE_DAEMON_AUTOSTART !== 'false',
  daemonDir: process.env.CLAUDE_DAEMON_DIR || path.resolve(__dirname, '..')
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

async function main() {
  await readStdin();

  let health = await healthCheck();

  if (!health && CONFIG.autoStart && CONFIG.host === 'localhost') {
    console.error('[memory] Daemon not running, attempting to start...');
    health = await startDaemon();
  }

  if (health) {
    const output = {
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: `[Semantic Memory] Active: ${health.memoryCount} memories available (model: ${health.embeddingModel})`
      }
    };
    console.log(JSON.stringify(output));
  } else {
    console.error(`[memory] Daemon unavailable. Start it with: cd ${CONFIG.daemonDir} && node server.js`);
  }
}

main().catch(e => {
  console.error(`[memory] Error: ${e.message}`);
});
