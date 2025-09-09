# Active Context

## Current Phase
✅ LATEST SUCCESS: Full custom prompt support working in both native and Docker (2025-09-09)

## Latest Updates: Custom Prompt File Support
Successfully implemented `--prompt-file` functionality for agent commands:

### Changes Made:
1. **Execution Context System (new):**
   - Created `src/execution-context.ts` for detecting Docker vs native environment
   - Created `src/prompt-resolver.ts` for cross-context prompt path resolution
   - Agents default to native execution, Manager to Docker

2. **CLI Enhancements:**
   - Added `--prompt-file=<path>` flag for custom prompts
   - Added `--docker` flag to force Docker execution
   - Added `--native`/`--host` flags to force native execution
   - Updated `claudo` bash script to route through cli.js for unified handling

3. **Agent Refactoring:**
   - Fixed critical issue: prompts containing "--" were being parsed as CLI arguments
   - Switched from `-p` flag with shell expansion to stdin piping
   - Removed dependency on shell: true, now using direct stdin
   - Dynamic prompt resolution based on execution context

4. **Docker Utils Extensions:**
   - Added execution context preference functions
   - Fallback logic when Docker unavailable
   - Context resolution with user override support

### Result:
✅ **Custom prompts work in both contexts**: `claudo plan --prompt-file=./custom.md "task"` works on host and in Docker
✅ **Container claudo command fixed**: Dockerfile updated to copy and configure claudo properly

## Critical Architecture Pattern - Agent Output Streaming

**The Manager-Agent communication flow is designed with intentional separation:**

### Desired UX Flow:
```
[Manager] → Bash: $ claudo plan "analyze requirements"
[Planner] → Read: Reading project files...  
[Planner] → Bash: Running analysis...
[Planner] ... (streaming JSON activity visible via logs)
[Planner] Final response: "Here's the plan..."
[Manager] Excellent! The planner suggests: [processes response]
```

### Key Design Principles:
1. **Session Capture**: When Manager spawns agent, capture the session ID from stderr
2. **Log Tailing**: Monitor `~/.claude/projects/` inside container for session logs
3. **Stream Integration**: Pipe session logs into Docker container output stream
4. **User Visibility**: `claudo logs -f` shows full readable streaming output from subagents
5. **Context Isolation**: Manager receives ONLY final text response, NOT streaming JSON
6. **Clean Separation**: User sees everything, Manager context stays clean

### Implementation Status:
- ✅ Session ID capture logic exists in agent.ts
- ✅ Log monitoring logic exists in logs.ts  
- ❌ **Missing**: Integration to pipe subagent logs into container output stream
- ❌ **Missing**: Manager not capturing/displaying agent responses properly

This architecture ensures observability without context pollution - users get full visibility while Manager maintains focused context.

## Escaping Issues - Recurring Theme
**Escaping problems have been a consistent challenge throughout this project:**
1. Shell escaping in prompts (backticks in markdown)
2. JSON escaping in tool parameters
3. Now: Mixed stdout streams (debug text + JSON)

## Current Architecture Status

### After Simplification Attempt
- ✅ Created `host-parser.ts` to run parser on host (where console.log works)
- ✅ Manager outputs to docker logs
- ❌ BUT: Docker logs contains both debug output AND JSON stream mixed together
- ❌ Parser can't distinguish between debug messages and actual JSON

### The Data Flow Problem
1. Manager process outputs debug messages to stdout/stderr
2. Claude CLI outputs JSON stream to stdout
3. Docker logs combines everything
4. Parser receives mixed stream and fails to parse debug lines

## Reliable Data Source
**`.claudo/manager-debug.jsonl` captures ONLY the JSON stream** - this file is clean and parseable.

## Potential Solutions

### Option 1: Read from Debug File (Most Reliable)
```javascript
// Instead of docker logs, read the clean JSON file
tail -f .claudo/manager-debug.jsonl | parser
```

### Option 2: Separate Debug Output
- Send debug messages to stderr only
- Keep stdout clean for JSON stream
- Docker logs can then filter: `docker logs claudo-manager 2>/dev/null`

### Option 3: Prefix Filtering
- Add unique prefix to JSON lines
- Filter in parser: only parse lines starting with prefix

## System Status
- ✅ **Manager Function**: Works correctly, processes tasks, reads memory-bank
- ✅ **Agent Spawning**: Works in both native and Docker contexts
- ✅ **Custom Prompts**: Full support for --prompt-file with path resolution
- ✅ **Execution Context**: Automatic detection of Docker vs native environment
- ✅ **Session Monitoring**: Session ID capture implemented
- ✅ **Clean Communication**: Text responses via stdin, no shell expansion issues
- ✅ **Docker claudo**: Command available and working in container
- ❌ **Response Capture**: Manager not properly displaying agent responses
- ❌ **Log Integration**: Subagent logs not piped to container output stream

## Key Files
- `src/host-parser.ts` - Host-based parser reading docker logs
- `src/manager-runner.ts` - Outputs both debug and JSON to stdout
- `.claudo/manager-debug.jsonl` - Clean JSON stream (reliable)
- `docker logs claudo-manager` - Mixed output stream (problematic)

## The Pattern
Every layer we add seems to create new escaping/mixing problems:
- Shell → Markdown escaping
- Process → JSON escaping  
- Docker → Stream mixing

Perhaps the solution is fewer layers, not more parsing.