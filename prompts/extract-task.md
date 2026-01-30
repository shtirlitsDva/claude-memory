<extraction-task>
<overview>
Read the provided transcript and extract valuable learnings for a semantic memory database.
These memories help Claude avoid rediscovering solutions in future sessions.
</overview>

<learning-types>
<type name="WORKING_SOLUTION">Commands, code patterns, or approaches that WORKED after trial/error</type>
<type name="GOTCHA">Counterintuitive behaviors, traps, "watch out for this" knowledge</type>
<type name="PATTERN">Recurring architectural decisions or workflows</type>
<type name="DECISION">Explicit design choices and their reasoning</type>
<type name="FAILURE">Things that looked promising but didn't work, and WHY</type>
<type name="PREFERENCE">User's stated preferences for how they want things done</type>
</learning-types>

<output-format>
Return ONLY a JSON array of learnings with no additional text:
[
  {"type": "GOTCHA", "content": "Specific learning here", "context": "Brief context", "confidence": 0.9},
  {"type": "WORKING_SOLUTION", "content": "Another learning", "context": "Context", "confidence": 0.85}
]
</output-format>

<rules>
<rule>Be specific - include actual commands, file paths, error messages, code</rule>
<rule>Prefer solutions over problems - extract the solution if one was found</rule>
<rule>Include context - what project/technology/situation triggered this</rule>
<rule>Confidence: 0.95+ = confirmed working, 0.85-0.94 = strong evidence, 0.70-0.84 = reasonable inference</rule>
<rule>Skip generic knowledge Claude already knows</rule>
<rule>Focus on user-specific knowledge: infrastructure, preferences, file paths, workflows</rule>
<rule>Maximum 200 characters per learning content</rule>
<rule>Extract 3-10 high-quality learnings per transcript</rule>
</rules>
</extraction-task>
