#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG = {
  host: process.env.CLAUDE_DAEMON_HOST || 'localhost',
  port: process.env.CLAUDE_DAEMON_PORT || 8741,
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

function parseTranscript(jsonlPath) {
  const content = fs.readFileSync(jsonlPath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());

  const messages = [];
  let sessionId = '';
  let projectPath = '';

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);

      if (entry.session_id || entry.sessionId) {
        sessionId = entry.session_id || entry.sessionId;
      }
      if (entry.cwd) {
        projectPath = entry.cwd;
      }

      const role = entry.type || entry.role;

      if (role === 'user') {
        const content = entry.message?.content || entry.content || entry.text || '';
        if (typeof content === 'string' && content.trim()) {
          messages.push({ role: 'user', content: content.trim() });
        }
      }

      if (role === 'assistant') {
        let assistantContent = '';
        let thinkingContent = '';

        const content = entry.message?.content || entry.content;

        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'thinking') {
              thinkingContent += block.thinking || '';
            } else if (block.type === 'text') {
              assistantContent += block.text || '';
            }
          }
        } else if (typeof content === 'string') {
          assistantContent = content;
        }

        if (entry.thinking) {
          thinkingContent = entry.thinking;
        }

        if (thinkingContent.trim() || assistantContent.trim()) {
          messages.push({
            role: 'assistant',
            thinking: thinkingContent.trim() || null,
            content: assistantContent.trim()
          });
        }
      }
    } catch (e) {
      continue;
    }
  }

  return { messages, sessionId, projectPath };
}

function toMarkdown(parsed, sessionId) {
  const { messages, projectPath } = parsed;

  let md = `<session-transcript>\n`;
  md += `<metadata>\n`;
  md += `session-id: ${sessionId}\n`;
  md += `project: ${projectPath}\n`;
  md += `exported: ${new Date().toISOString()}\n`;
  md += `</metadata>\n\n`;

  for (const msg of messages) {
    if (msg.role === 'user') {
      md += `<user>\n${msg.content}\n</user>\n\n`;
    } else if (msg.role === 'assistant') {
      md += `<assistant>\n`;
      if (msg.thinking) {
        md += `<thinking>\n${msg.thinking}\n</thinking>\n`;
      }
      if (msg.content) {
        md += `<response>\n${msg.content}\n</response>\n`;
      }
      md += `</assistant>\n\n`;
    }
  }

  md += `</session-transcript>\n`;
  return md;
}

async function main() {
  const inputData = await readStdin();

  let input;
  try {
    input = JSON.parse(inputData);
  } catch (e) {
    console.error('[pre-compact] Invalid JSON input');
    process.exit(0);
  }

  const sessionId = input.session_id || input.sessionId || `session_${Date.now()}`;
  const transcriptPath = input.transcript_path || input.transcriptPath;
  const projectPath = input.cwd || '';

  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    console.error('[pre-compact] No transcript found, skipping');
    process.exit(0);
  }

  const sessionDir = path.join(CONFIG.transcriptsDir, sessionId);
  fs.mkdirSync(sessionDir, { recursive: true });

  fs.copyFileSync(transcriptPath, path.join(sessionDir, 'transcript.jsonl'));
  console.error('[pre-compact] ✓ Exported transcript');

  const parsed = parseTranscript(transcriptPath);
  const markdown = toMarkdown(parsed, sessionId);
  const mdPath = path.join(sessionDir, 'transcript.md');
  fs.writeFileSync(mdPath, markdown, 'utf8');
  console.error(`[pre-compact] ✓ Converted ${parsed.messages.length} messages to markdown`);

  const metadata = {
    session_id: sessionId,
    project_path: projectPath,
    exported_at: new Date().toISOString(),
    transcript_path: mdPath,
    daemon_url: DAEMON_URL,
    status: 'pending_extraction'
  };
  fs.writeFileSync(path.join(sessionDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
  console.error('[pre-compact] ✓ Wrote metadata');

  const subagentInstructions = `
<pre-compact-extraction-required>
Session transcript has been exported and needs learning extraction.

TRANSCRIPT PATH: ${mdPath}
SESSION ID: ${sessionId}
DAEMON URL: ${DAEMON_URL}

Dispatch a sub-agent using the Task tool with this prompt:

---
Read the transcript at ${mdPath} and extract learnings to store in the semantic memory database.

For each learning you find, store it by running:
curl -X POST ${DAEMON_URL}/store -H "Content-Type: application/json" -d '{"type": "<TYPE>", "content": "<LEARNING>", "context": "<CONTEXT>", "confidence": <SCORE>, "sessionSource": "${sessionId}"}'

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
- Skip incomplete thoughts and debugging noise
- Focus on user-specific infrastructure, preferences, workflows
- Keep content under 200 characters, use context for details
---

</pre-compact-extraction-required>
`;

  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreCompact',
      additionalContext: subagentInstructions.trim()
    }
  };

  console.log(JSON.stringify(output));
}

main().catch(e => {
  console.error(`[pre-compact] Error: ${e.message}`);
  process.exit(0);
});
