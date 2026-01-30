#!/usr/bin/env node
/**
 * Batch Process Existing Transcripts
 *
 * Orchestrates the full pipeline:
 * 1. Convert JSONL transcripts to markdown
 * 2. Extract learnings (via CLI prompt or automated)
 * 3. Import extracted learnings to daemon
 *
 * Usage: node batch-process.js [options]
 *
 * Options:
 *   --convert-only    Only convert transcripts, don't extract
 *   --import <file>   Import from existing JSONL file
 *   --projects <dir>  Custom projects directory (default: ~/.claude/projects)
 *   --output <dir>    Output directory (default: ./converted-transcripts)
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const DAEMON_URL = 'http://localhost:8741';

function expandPath(p) {
  return p.replace(/^~/, process.env.HOME || process.env.USERPROFILE);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    convertOnly: false,
    importFile: null,
    projectsDir: expandPath('~/.claude/projects'),
    outputDir: expandPath('./converted-transcripts'),
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--convert-only':
        options.convertOnly = true;
        break;
      case '--import':
        options.importFile = expandPath(args[++i]);
        break;
      case '--projects':
        options.projectsDir = expandPath(args[++i]);
        break;
      case '--output':
        options.outputDir = expandPath(args[++i]);
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
<batch-process>
  <overview>
    Batch Process Existing Claude Code Transcripts
    Converts session transcripts to markdown and prepares for learning extraction.
  </overview>

  <usage>
    node batch-process.js [options]
  </usage>

  <options>
    --convert-only    Only convert transcripts to markdown
    --import <file>   Import learnings from existing JSONL file
    --projects <dir>  Custom projects directory (default: ~/.claude/projects)
    --output <dir>    Output directory for markdown (default: ./converted-transcripts)
    --help, -h        Show this help
  </options>

  <workflow>
    <step-1>Convert: node batch-process.js --convert-only</step-1>
    <step-2>Extract: Run extraction prompt in Claude Code (see prompts/extract-learnings.md)</step-2>
    <step-3>Import: node batch-process.js --import ~/extracted-learnings.jsonl</step-3>
  </workflow>
</batch-process>
`);
}

async function checkDaemon() {
  try {
    const response = await fetch(`${DAEMON_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

function runConverter(projectsDir, outputDir) {
  const scriptPath = path.join(__dirname, 'jsonl-to-markdown.js');

  console.log('<conversion>');
  console.log(`  <source>${projectsDir}</source>`);
  console.log(`  <destination>${outputDir}</destination>`);
  console.log('</conversion>\n');

  try {
    execSync(`node "${scriptPath}" "${projectsDir}" "${outputDir}"`, {
      stdio: 'inherit'
    });
    return true;
  } catch (e) {
    console.error('Conversion failed:', e.message);
    return false;
  }
}

function runImporter(jsonlFile) {
  const scriptPath = path.join(__dirname, 'import-learnings.js');

  console.log('<import>');
  console.log(`  <source>${jsonlFile}</source>`);
  console.log('</import>\n');

  try {
    execSync(`node "${scriptPath}" "${jsonlFile}"`, {
      stdio: 'inherit'
    });
    return true;
  } catch (e) {
    console.error('Import failed:', e.message);
    return false;
  }
}

function countMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter(f => f.endsWith('.md')).length;
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  console.log(`
========================================
  Claude Memory Batch Processor
========================================
`);

  // Import mode
  if (options.importFile) {
    if (!fs.existsSync(options.importFile)) {
      console.error(`File not found: ${options.importFile}`);
      process.exit(1);
    }

    const daemonReady = await checkDaemon();
    if (!daemonReady) {
      console.error('Memory daemon not running. Start with: npm start');
      process.exit(1);
    }

    runImporter(options.importFile);
    return;
  }

  // Convert mode
  if (!fs.existsSync(options.projectsDir)) {
    console.error(`Projects directory not found: ${options.projectsDir}`);
    process.exit(1);
  }

  console.log('Step 1: Converting transcripts to markdown...\n');
  const convertSuccess = runConverter(options.projectsDir, options.outputDir);

  if (!convertSuccess) {
    process.exit(1);
  }

  const fileCount = countMarkdownFiles(options.outputDir);

  if (options.convertOnly) {
    console.log(`
<next-steps>
  <step-1>
    <title>Extract Learnings</title>
    <description>
      Open a NEW Claude Code session and paste the extraction prompt from:
      prompts/extract-learnings.md

      Point it to: ${options.outputDir}
      This will create: ~/extracted-learnings.jsonl
    </description>
  </step-1>

  <step-2>
    <title>Import to Database</title>
    <command>node scripts/batch-process.js --import ~/extracted-learnings.jsonl</command>
  </step-2>
</next-steps>
`);
    return;
  }

  console.log(`
<summary>
  <converted>${fileCount} transcripts</converted>
  <location>${options.outputDir}</location>
</summary>

<extraction-instructions>
  To extract learnings from these transcripts:

  1. Start a NEW Claude Code session
  2. Paste the extraction prompt from: prompts/extract-learnings.md
  3. Update the path to: ${options.outputDir}
  4. Let Claude process all files and output to ~/extracted-learnings.jsonl
  5. Run: node scripts/batch-process.js --import ~/extracted-learnings.jsonl
</extraction-instructions>
`);
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
