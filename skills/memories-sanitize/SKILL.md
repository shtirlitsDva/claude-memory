---
name: memories-sanitize
description: Review recent memories and remove invalid or misleading ones from the semantic memory database
---

# Memory Sanitization Procedure

Review memories created in recent sessions and identify those that are **invalid**, **misleading**, or based on **incorrect hypotheses** from debugging sessions.

## Step 1: List Recent Memories

Query the daemon to get all memories:

```bash
curl -s http://localhost:8741/list
```

This returns JSON with all memories including:
- `id` - Memory ID (e.g., `mem_abc123`)
- `type` - GOTCHA, WORKING_SOLUTION, PATTERN, DECISION, FAILURE, PREFERENCE
- `content` - The learning content
- `context` - Additional context
- `confidence` - Confidence score (0-1)
- `createdAt` - ISO timestamp

## Step 2: Identify Invalid Memories

Review each memory and mark as INVALID if it:

1. **Was a red herring** - An initial hypothesis that turned out to be wrong
2. **Blames the wrong component** - Points to code that was actually working correctly
3. **Describes a non-issue** - Something suspected as a bug but wasn't
4. **Has outdated information** - Was true but no longer applies after a fix
5. **Contradicts confirmed findings** - Conflicts with what was actually discovered

## Step 3: Delete Invalid Memories

For each invalid memory, delete it:

```bash
curl -s -X DELETE http://localhost:8741/memory/<MEMORY_ID>
```

Example:
```bash
curl -s -X DELETE http://localhost:8741/memory/mem_abc123
```

## Step 4: Add Corrected Memories (Optional)

If an invalid memory should be replaced with a correct version:

```bash
curl -s -X POST http://localhost:8741/store \
  -H "Content-Type: application/json" \
  -d '{
    "type": "WORKING_SOLUTION",
    "content": "<CORRECT_LEARNING>",
    "context": "<CONTEXT>",
    "confidence": 0.95
  }'
```

## Memory Types Reference

| Type | Use For |
|------|---------|
| `GOTCHA` | Counterintuitive behaviors, traps, "watch out for this" |
| `WORKING_SOLUTION` | Commands, code, or approaches that worked |
| `PATTERN` | Recurring architectural decisions or workflows |
| `DECISION` | Explicit design choices with reasoning |
| `FAILURE` | What didn't work and why (useful to avoid repeating) |
| `PREFERENCE` | User's stated preferences |

## Example Sanitization

**Scenario**: During debugging, you suspected a `==` vs `.Equals()` operator issue, but later discovered the real cause was a tolerance value being too small.

**Invalid memory to delete**:
> "Reference equality vs .Equals() mismatch causes graph disconnection"

**Correct memory to add**:
> "Coordinate tolerance 1e-6 too small for reprojected coords; use 0.01m for EPSG:3857"

## Tips

- Always wait until debugging is complete before extracting memories
- Red herrings from debugging are common - don't let them pollute the memory database
- Confidence scores matter: lower confidence for uncertain findings
- Context field helps future retrieval - be specific about file paths and scenarios
