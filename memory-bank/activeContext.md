# Active Context

## Current Phase
✅ LATEST PROGRESS: Docker path issues resolved in claudo script (2025-09-09)

## Latest Updates: Agent Communication & Session Monitoring
Fixed the critical agent spawning issue and enhanced the monitoring system:

### Changes Made:
1. **src/agent.ts fixes:**
   - Corrected prompt path from `/usr/local/lib/claudo/prompts/` → `/workspace/prompts/`
   - Removed `--output-format stream-json` to prevent Manager context pollution
   - Added session ID capture from Claude's verbose stderr output
   - Store session IDs in `.claudo/[agent]-session.txt` for monitoring
   - Return clean text responses to Manager (not streaming JSON)

2. **src/logs.ts enhancements:**
   - Added session monitoring that detects new subagent sessions
   - Automatically tails specific session log files based on captured session IDs
   - Monitors `~/.claude/projects/-home-alex-code-full-claudo/[session-id].jsonl`
   - Provides real-time parsed output for subagents while keeping Manager context clean

3. **Architecture improvements:**
   - Manager gets clean text responses from subagents
   - User sees full verbose activity via `claudo logs -f`
   - No streaming JSON pollution in Manager's context
   - Proper session isolation and monitoring

### Result:
The Manager can now successfully spawn subagents using the corrected `claudo plan/worker/critic/oracle` commands, with users getting full visibility into subagent activity while maintaining clean inter-agent communication.

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
- ✅ **Agent Spawning Paths**: FIXED - corrected Docker path detection in claudo script (2025-09-09)
- 🚧 **Agent Process Execution**: Secondary issue identified - agents spawn but don't complete properly
- ✅ **Session Monitoring**: Auto-detects and tails subagent sessions (when working)
- ✅ **Clean Communication**: Architecture ready for text responses from subagents
- ✅ **Live Output**: Enhanced logs with subagent monitoring operational

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