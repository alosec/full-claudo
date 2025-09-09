# Active Context

## Current Phase
🚨 TOP PRIORITY: Subagent outputs are invisible - Worker/Planner/Critic/Oracle run but their streaming JSON is not visible (2025-09-09)

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
✅ **Custom prompts work from HOST**: `claudo plan --prompt-file=./custom.md "task"` works when called from host
✅ **Manager spawning working**: Manager can spawn agents using `node dist/src/agent.js plan "task"`
✅ **Critical solution found**: Direct node calls bypass claudo routing and work perfectly in container

## 🚨 CRITICAL: Subagent Visibility Gap

**Current Reality vs Desired UX:**
- **Working**: Manager → Planner → Worker → Critic orchestration ✅
- **BROKEN**: Subagent activities are completely invisible to users ❌

### The Visibility Problem:
```
Current (BROKEN):
[Manager] → Bash: $ node dist/src/agent.js plan "task"
[Manager] ... (166 seconds of silence)
[Manager] ✓ Completed

Desired:
[Manager] → Bash: $ node dist/src/agent.js plan "task" 
[Planner] → Read: Reading project files...
[Planner] → Write: Creating task structure...
[Planner] → Bash: Running validation...
[Planner] Final response: "Task created successfully"
[Manager] ✓ Completed
```

### Why This Is TOP PRIORITY:
1. **Worker is working blind** - No visibility into what it's doing
2. **Planner created tasks invisibly** - User can't see the planning process
3. **Critic reviewed silently** - No insight into review process
4. **Debug impossible** - When agents fail, no way to see why
5. **Trust issues** - Users can't trust what they can't see

### Technical Requirements:
1. **Session ID Capture**: Extract session ID when Manager spawns agent
2. **Log File Discovery**: Find agent's ~/.claude/projects/*/[session].jsonl
3. **Stream Parser Integration**: Pipe agent logs through ClaudeStreamParser
4. **Output Multiplexing**: Show both Manager and subagent streams in `claudo logs -f`
5. **Real-time Updates**: Stream must show activity as it happens, not after completion

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
- ✅ **Agent Spawning from Manager**: WORKING - Manager spawns agents using `node dist/src/agent.js [type] "task"`
- ✅ **Custom Prompts from Host**: --prompt-file works when called directly from host
- ✅ **Execution Context**: Automatic detection of Docker vs native environment
- ✅ **Session Monitoring**: Session ID capture implemented
- ✅ **Clean Communication**: Text responses via stdin, no shell expansion issues
- ✅ **Direct Node Execution**: Agents work perfectly when called directly with node
- ✅ **Response Capture**: Manager receives clean text responses from agents
- ✅ **Multi-Agent Orchestration**: Full Manager → Planner → Worker → Critic flow confirmed working

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