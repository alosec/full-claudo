# Active Context

## Current Phase
✅ MULTI-AGENT ORCHESTRATION PROVEN: Manager → Planner Flow Working (2025-09-12)

## Latest Achievement: Testable Manager Command (2025-09-12)

### Breakthrough: `claudo manager` Command Implemented
✅ **Manager is now testable** with clean, one-shot execution modes:
- `claudo manager -p "prompt"` - Direct prompt execution with clean output
- `claudo manager -it` - Interactive mode (launches Claude Code)
- `claudo manager --test` - Test mode with simplified responses
- `claudo manager --prompt-file file.md` - Custom prompt from file

### Key Architectural Decision
**Separated concerns correctly:**
- `claudo up` - Reserved for future long-running orchestrator (the "marshmallow 5 feet high")
- `claudo manager` - Current reality for testable, observable Manager execution
- Removed nonsensical `claudo up -p` combination

### Test Results: Multi-Agent Orchestration Confirmed
✅ **Test 1**: Manager responds with haiku (direct execution)
✅ **Test 2**: Manager spawns Planner agent which generates different haiku
- Two separate Claude API calls working in sequence
- Manager receives and relays Planner's output correctly
- Proves the orchestration mechanism works end-to-end

## Previous Achievement: Testing Framework (2025-09-11)

### What's Working NOW
✅ **`npm run test:manager` CONFIRMED WORKING** - First meaningful end-to-end test!
- Manager accepts test prompts via stdin (--prompt-stdin flag)
- Real Claude CLI calls with actual API responses
- Verifiable output: "MANAGER: Hello World - I am operational"
- Observable test flow with clear PASS/FAIL indicators

### Testing Implementation
1. **manager-runner.ts enhanced** with testing mode:
   - Detects `TESTING_MODE=true` or `--testing` flag
   - Accepts custom prompts via stdin instead of reading manager.md
   - Still calls real Claude CLI for true end-to-end validation

2. **Test Infrastructure Created**:
   - `tests/run-test.sh` - Simple bash runner with verification
   - `tests/prompts/` - Test scenario prompts
   - Clear output showing exact commands and responses

### Latest Progress (2025-09-11 23:45)
✅ **Parsed output implemented** - Tests now show clean, readable output
✅ **Haiku test validates real API calls** - Each run generates unique creative response
✅ **Test infrastructure proven** - Observable, verifiable end-to-end testing works

### Next Initiative: Full Orchestration with Visibility
**Goal**: Run `claudo up` and observe the complete multi-agent flow with proper visibility

**The Challenge**:
- Manager needs to spawn agents that output JSON streams (for session tracking)
- Manager should only receive clean text responses (avoid context pollution)
- Host needs to watch all agent sessions in real-time (parse JSON streams)
- Sessions should be tracked in `~/.claude/projects/` (volumed out from container)

**Architecture Needed**:
1. **Manager runs with stream-json** → outputs to `.claudo/manager-output.jsonl`
2. **Spawned agents run with stream-json** → output to `.claudo/sessions/[agent-type]-[timestamp].jsonl`
3. **Host parser watches all JSONL files** → displays parsed, color-coded activity
4. **Manager uses --print when spawning** → receives only clean text responses
5. **Session tracking** → All activity preserved for debugging and analysis

## Previous Updates: Custom Prompt File Support
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

## Interactive Manager Mode - BLOCKED (2025-09-09)

### Current Status: TTY/Raw Mode Incompatibility
Attempted to implement interactive Manager mode (`claudo up -it`) but hit fundamental blocker:

#### The Problem
1. **Claude CLI requires raw TTY mode** for interactive sessions (uses Ink library)
2. **Docker stdio pipes don't support raw mode** properly
3. **Result**: Error "Raw mode is not supported on the current process.stdin"

#### Attempted Solutions (All Failed)
1. **Direct stdio inherit**: Claude crashes with raw mode error
2. **Using --print flag**: Works but makes it non-interactive (single response only)
3. **Using script command**: Not available in minimal Docker container
4. **Pseudo-TTY via script**: Would need to install additional tools in container

#### Root Cause
The Claude Code CLI is designed for direct terminal use and expects full TTY capabilities. Docker's `-it` flag provides some TTY emulation but not enough for Claude's Ink-based UI which requires raw mode control.

#### Next Steps for New Session
Consider alternative approaches:
1. **Run Manager on host** (not in Docker) for `-it` mode
2. **Create verbose debug mode** that logs all Manager decisions without interactivity
3. **Install necessary TTY tools** in Docker image (script, socat, etc.)
4. **Use different CLI approach** that doesn't require raw mode

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