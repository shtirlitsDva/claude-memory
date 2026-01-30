#!/usr/bin/env node
/**
 * Import Learnings from JSONL
 *
 * Reads extracted learnings from a JSONL file and stores them via the memory daemon.
 *
 * Usage: node import-learnings.js <jsonl-file>
 * Example: node import-learnings.js ~/extracted-learnings.jsonl
 */

const fs = require('fs');
const path = require('path');

const DAEMON_URL = 'http://localhost:8741';

async function checkDaemon() {
  try {
    const response = await fetch(`${DAEMON_URL}/health`);
    if (!response.ok) throw new Error('Daemon not healthy');
    return true;
  } catch (e) {
    return false;
  }
}

async function storeLearning(learning) {
  const response = await fetch(`${DAEMON_URL}/store`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(learning)
  });
  return response.json();
}

async function getStats() {
  const response = await fetch(`${DAEMON_URL}/stats`);
  return response.json();
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('Usage: node import-learnings.js <jsonl-file>');
    console.log('');
    console.log('Example:');
    console.log('  node import-learnings.js ~/extracted-learnings.jsonl');
    process.exit(1);
  }

  const inputFile = args[0].replace('~', process.env.HOME || process.env.USERPROFILE);

  if (!fs.existsSync(inputFile)) {
    console.error(`File not found: ${inputFile}`);
    process.exit(1);
  }

  console.log('Checking memory daemon...');
  const daemonReady = await checkDaemon();
  if (!daemonReady) {
    console.error('Memory daemon not running. Start it with: npm start');
    process.exit(1);
  }
  console.log('Daemon is ready.\n');

  const content = fs.readFileSync(inputFile, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);

  console.log(`Found ${lines.length} learnings to import.\n`);

  let imported = 0;
  let duplicates = 0;
  let errors = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    try {
      const learning = JSON.parse(line);

      if (!learning.type || !learning.content) {
        console.log(`  [${i + 1}] x Missing required fields`);
        errors++;
        continue;
      }

      const result = await storeLearning(learning);

      if (result.status === 'stored') {
        console.log(`  [${i + 1}] + ${learning.type}: ${learning.content.substring(0, 50)}...`);
        imported++;
      } else if (result.status === 'duplicate') {
        console.log(`  [${i + 1}] o Duplicate (${(result.similarity * 100).toFixed(0)}% similar)`);
        duplicates++;
      } else {
        console.log(`  [${i + 1}] x ${result.error || 'Unknown error'}`);
        errors++;
      }

    } catch (e) {
      console.log(`  [${i + 1}] x Parse error: ${e.message}`);
      errors++;
    }
  }

  console.log('\n========================================');
  console.log(`Imported:   ${imported}`);
  console.log(`Duplicates: ${duplicates}`);
  console.log(`Errors:     ${errors}`);

  const stats = await getStats();
  console.log('\nDatabase Stats:');
  console.log(`  Total memories: ${stats.total}`);
  if (stats.byType) {
    for (const [type, count] of Object.entries(stats.byType)) {
      console.log(`    ${type}: ${count}`);
    }
  }
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
