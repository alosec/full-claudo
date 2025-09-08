Fix Manager and Agent logging - output stops after initial reads but Claude continues working invisibly

CRITICAL: The multi-agent system is working but we can't see what it's doing!

Problem:
- Manager starts and shows initial output (reading memory bank, etc)
- Then output stops completely
- But Claude processes continue running and doing work
- Agents are spawning, implementing features, committing code - all invisibly
- The streaming parser (src/parser.ts) seems to fail silently

Need to:
1. Debug why ClaudeStreamParser stops outputting after initial messages
2. Add error handling to catch parser failures
3. Consider fallback logging mechanism
4. Possibly add file-based logging as backup
5. Test with simpler output format first

This is highest priority - we need visibility into what the system is doing!