# Active Context

## Current Phase
🔄 STRATEGIC PIVOT: Interactive Manager Mode for Direct Debugging (2025-09-09)

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

## Interactive Manager Mode - IMPLEMENTED (2025-09-09)

### Problem Solved
Previous attempts at subagent visibility were too complex:
- Session file monitoring had timing issues
- Log multiplexing was fragile
- JSON stream parsing created context pollution

### Solution: Interactive Manager (`claudo up -it`)
Implemented a simpler, more powerful approach:

#### What It Does
- Launches Manager as interactive Claude Code session
- Runs Docker container with `-it` flag for terminal attachment
- Bypasses JSON streaming in favor of direct Claude interface
- Provides full visibility into Manager's tool use and subagent calls

#### How to Use
```bash
# Start interactive Manager
claudo up -it

# In the Manager session, spawn subagents:
# Use Bash tool: node dist/src/agent.js plan "task"
# Use Bash tool: node dist/src/agent.js worker "implement feature"
```

#### Implementation Details
1. **CLI** (`src/cli.ts`): Added `-it` flag parsing, sets `CLAUDO_INTERACTIVE` env var
2. **Up Command** (`src/up.ts`): Detects interactive mode, uses `docker run -it --rm` instead of `-d`
3. **Manager Runner** (`src/manager-runner.ts`): Switches between JSON streaming (normal) and direct Claude (interactive)

#### Benefits Achieved
- ✅ Direct visibility into Manager operations
- ✅ Real-time debugging of subagent spawning
- ✅ No complex log parsing needed
- ✅ Native Claude Code interface with full tool visibility
- ✅ Can manually test and debug agent coordination

## Previous Attempts Summary

### Subagent Visibility Attempts
1. **Session ID extraction from verbose mode** - Verbose doesn't output session ID without stream-json
2. **Stream-JSON parsing** - Works but creates context pollution for Manager
3. **Log file monitoring** - Session files created but real-time tailing complex
4. **Standalone logs mode** - Implemented but monitoring not detecting sessions properly

### Complexity Issues Encountered
- Shell escaping in prompts (backticks in markdown)
- JSON escaping in tool parameters
- Mixed stdout streams (debug text + JSON)
- Session file discovery timing issues
- Parser synchronization problems

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