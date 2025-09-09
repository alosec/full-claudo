# Task: Test Session ID Capture

## Status
- [x] Not Started
- Created: 2025-09-09
- Priority: High

## Description
Create a test task to validate that session ID capture is working correctly when the Manager spawns subagents. This addresses the critical visibility gap where subagent activities are invisible to users.

## Requirements
- Verify session ID extraction from Claude's verbose output works
- Test metadata file creation in `.claudo/` directory
- Validate that session files can be found and monitored
- Ensure log streaming can discover and tail subagent session files
- Test both old format (session.txt + project.txt) and new format (metadata.json)

## Acceptance Criteria
- [ ] Session ID is correctly extracted from verbose output when spawning test agent
- [ ] Metadata files are created in `.claudo/[agent-type]-metadata.json` format
- [ ] Session log file path is correctly constructed and accessible
- [ ] `claudo logs -f` can discover and tail the subagent session file
- [ ] Debug output shows session capture working when DEBUG_AGENT=1

## Implementation Steps
1. Create a simple test that spawns a Planner agent with a minimal task
2. Verify session ID capture by checking `.claudo/plan-metadata.json`
3. Test log monitoring by running `claudo logs -f` while agent executes
4. Validate that subagent JSON stream appears in logs output
5. Add debugging output to confirm session discovery timing

## Files to Modify
- `src/agent.ts` - Already implements session capture (lines 89-158)
- `src/logs.ts` - Already implements session monitoring (lines 44-140) 
- `.claudo/` directory - Will contain metadata files during test

## Technical Notes
Current session capture implementation:
- Extracts session ID from stderr: `/Session ID:\s+([a-f0-9-]+)/i`
- Extracts project path from stderr: `/Project:\s+([^\s]+\.claude\/projects\/[^\s]+)/i`
- Creates metadata.json with sessionFile path for monitoring
- Logs monitoring polls every 1 second for new session files

## Test Command
```bash
# Enable debug mode and test session capture
DEBUG_AGENT=1 node dist/src/agent.js plan "Create a simple test file"
```

## Expected Output
- Session ID extracted and written to `.claudo/plan-session.txt`
- Project path written to `.claudo/plan-project.txt`  
- Enhanced metadata written to `.claudo/plan-metadata.json`
- Debug messages showing session capture when DEBUG_AGENT=1