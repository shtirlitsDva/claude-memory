#!/usr/bin/env node
/**
 * JSONL to Markdown Transcript Converter
 *
 * Converts Claude Code .jsonl transcripts to readable markdown format.
 * Outputs ONLY: user messages, assistant messages (including thinking blocks), and system prompts.
 * Strips tool calls and tool results for cleaner extraction.
 *
 * Usage: node jsonl-to-markdown.js <input-dir> <output-dir>
 * Example: node jsonl-to-markdown.js ~/.claude/projects/ ./converted-transcripts/
 */

const fs = require('fs');
const path = require('path');

function findJsonlFiles(dir, files = []) {
  if (!fs.existsSync(dir)) {
    console.error(`Directory not found: ${dir}`);
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findJsonlFiles(fullPath, files);
    } else if (entry.name.endsWith('.jsonl')) {
      files.push(fullPath);
    }
  }

  return files;
}

function parseTranscript(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);

  const messages = [];
  let sessionId = null;
  let projectPath = null;

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);

      if (entry.sessionId) sessionId = entry.sessionId;
      if (entry.cwd) projectPath = entry.cwd;

      if (entry.type === 'user' || entry.role === 'user') {
        const text = entry.message?.content || entry.content || entry.text || '';
        if (text.trim()) {
          messages.push({
            role: 'user',
            content: typeof text === 'string' ? text : JSON.stringify(text)
          });
        }
      }

      if (entry.type === 'assistant' || entry.role === 'assistant') {
        let assistantContent = '';
        let thinkingContent = '';

        if (Array.isArray(entry.message?.content || entry.content)) {
          const contentArray = entry.message?.content || entry.content;

          for (const block of contentArray) {
            if (block.type === 'thinking') {
              thinkingContent += block.thinking || '';
            } else if (block.type === 'text') {
              assistantContent += block.text || '';
            }
          }
        } else {
          assistantContent = entry.message?.content || entry.content || entry.text || '';
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

      if (entry.type === 'system' || entry.role === 'system') {
        const text = entry.message?.content || entry.content || entry.text || '';
        if (text.trim()) {
          messages.push({
            role: 'system',
            content: typeof text === 'string' ? text : JSON.stringify(text)
          });
        }
      }

    } catch (e) {
      continue;
    }
  }

  return { messages, sessionId, projectPath, sourcePath: filePath };
}

function toMarkdown(parsed) {
  const { messages, sessionId, projectPath, sourcePath } = parsed;

  let md = `# Session Transcript\n\n`;
  md += `**Session ID**: ${sessionId || 'Unknown'}\n`;
  md += `**Project**: ${projectPath || 'Unknown'}\n`;
  md += `**Source**: ${sourcePath}\n`;
  md += `**Converted**: ${new Date().toISOString()}\n\n`;
  md += `---\n\n`;

  for (const msg of messages) {
    if (msg.role === 'user') {
      md += `## User\n\n${msg.content}\n\n`;
    } else if (msg.role === 'assistant') {
      md += `## Assistant\n\n`;
      if (msg.thinking) {
        md += `<details>\n<summary>Thinking</summary>\n\n${msg.thinking}\n\n</details>\n\n`;
      }
      if (msg.content) {
        md += `${msg.content}\n\n`;
      }
    } else if (msg.role === 'system') {
      md += `## System\n\n${msg.content}\n\n`;
    }
    md += `---\n\n`;
  }

  return md;
}

function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: node jsonl-to-markdown.js <input-dir> <output-dir>');
    console.log('');
    console.log('Example:');
    console.log('  node jsonl-to-markdown.js ~/.claude/projects/ ./converted-transcripts/');
    console.log('');
    console.log('This will recursively find all .jsonl files in the input directory');
    console.log('and convert them to markdown in the output directory.');
    process.exit(1);
  }

  const inputDir = args[0].replace('~', process.env.HOME || process.env.USERPROFILE);
  const outputDir = args[1].replace('~', process.env.HOME || process.env.USERPROFILE);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Scanning ${inputDir} for .jsonl files...`);
  const files = findJsonlFiles(inputDir);
  console.log(`Found ${files.length} transcript files.\n`);

  if (files.length === 0) {
    console.log('No .jsonl files found. Check your input directory.');
    process.exit(0);
  }

  let converted = 0;
  let skipped = 0;

  for (const file of files) {
    try {
      const parsed = parseTranscript(file);

      if (parsed.messages.length === 0) {
        skipped++;
        continue;
      }

      const markdown = toMarkdown(parsed);

      const baseName = path.basename(file, '.jsonl');
      const outputPath = path.join(outputDir, `${baseName}.md`);

      fs.writeFileSync(outputPath, markdown, 'utf-8');
      converted++;

      console.log(`+ ${baseName} (${parsed.messages.length} messages)`);

    } catch (e) {
      console.error(`x Failed: ${file} - ${e.message}`);
      skipped++;
    }
  }

  console.log(`\n========================================`);
  console.log(`Converted: ${converted} files`);
  console.log(`Skipped: ${skipped} files (empty or malformed)`);
  console.log(`Output: ${outputDir}`);
}

main();
