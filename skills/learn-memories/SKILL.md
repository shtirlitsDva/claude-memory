---
name: learn-memories
description: Extract learnings from session transcripts and store in semantic memory database
disable-model-invocation: true
allowed-tools: Bash(curl *), Read
---

Extract learnings from the most recent session transcript and store them in the semantic memory database.

<instructions>
1. Read the metadata file at ~/.claude/transcripts/latest.json to find the transcript path
2. Launch a background sub-agent using the Task tool with `run_in_background: true` to extract learnings
3. Return immediately - do not wait for the sub-agent to complete
4. Tell the user that extraction is running in background

The sub-agent prompt should be:

---
Read the transcript at [TRANSCRIPT_PATH] and extract learnings to store in the semantic memory database.

For each learning you find, store it by running:
curl -X POST http://localhost:8741/store -H "Content-Type: application/json" -d '{"type": "<TYPE>", "content": "<LEARNING>", "context": "<CONTEXT>", "confidence": <SCORE>}'

LEARNING TYPES:
- WORKING_SOLUTION: Commands, code, or approaches that WORKED
- GOTCHA: Traps, counterintuitive behaviors, "watch out for this"
- PATTERN: Recurring architectural decisions or workflows
- DECISION: Explicit design choices with reasoning
- FAILURE: Things that looked promising but didn't work
- PREFERENCE: User's stated preferences

RULES:
- Be specific - include actual commands, paths, error messages
- Confidence 0.95 for explicitly confirmed, 0.85 for strong evidence
- Skip generic programming knowledge Claude already knows
- Skip incomplete thoughts and debugging noise
- Focus on user-specific infrastructure, preferences, workflows
- Keep content under 200 characters, use context for details
- Extract 5-15 learnings per session, focus on quality over quantity
---
</instructions>
