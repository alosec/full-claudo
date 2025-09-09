# Current Blockers & Initiatives

## 🚧 Initiative 1: Agent Launching Script Environment Issue (HIGH PRIORITY)

### Problem
Manager Claude is operational and can read tasks, but fails when attempting to spawn other agents. The issue appears to be that the agent spawning scripts (`claudo plan/worker/critic/oracle`) expect to run outside Docker but are now being executed from within the container environment.

### Current Architecture Status
- ✅ **Manager Function**: Works correctly, processes tasks, reads memory-bank
- ✅ **Docker Environment**: Container has proper Claude CLI access and authentication
- ❌ **Agent Spawning**: Scripts may need adaptation for container-internal execution

### Investigation Needed
The agent scripts might need to be modified to work properly when launched from within the Docker container. The container itself has Claude CLI available, so theoretically agents should be able to run.

### Proposed Solution
Create an inbox item requesting the Manager directly investigate and fix the agent launching scripts by:
1. Exploring current script behavior within container
2. Identifying the correct pattern to launch agents from container environment  
3. Testing and validating agent spawning works end-to-end

### Next Action
**Create inbox item**: "Fix agent launching scripts to work correctly within Docker container environment"

### Status
⏳ **Solution Identified** - Ready to create inbox task for Manager to resolve

---

## 🚧 Initiative 2: Log Parser & UX Improvement (MEDIUM PRIORITY)

### Problem
Claude CLI outputs extremely verbose JSON streaming logs that are overwhelming:
- Every tool call generates multiple JSON objects
- Hard to follow what's actually happening
- Poor user experience for monitoring progress

### Example Current Output
```json
{"type":"assistant","message":{"id":"msg_01","content":[{"type":"tool_use","id":"toolu_01","name":"Bash","input":{"command":"git init"}}]}}
{"type":"user","message":{"role":"user","content":[{"tool_use_id":"toolu_01","type":"tool_result","content":"Initialized empty Git repository"}]}}
```

### Desired Output
```
[Manager] Initializing git repository...
[Manager] ✅ Git repository created
[Manager] Creating memory-bank structure...
[Manager] ✅ Project structure complete
[Manager] 🔄 Spawning Planner agent...
```

### Solution Approach
Create a log parser that:
1. Reads stream-json output in real-time
2. Extracts meaningful actions and results
3. Formats as brief, human-readable status updates
4. Shows progress indicators and completion status

### Implementation Plan
1. **Parser Module**: TypeScript module to process JSON stream
2. **Action Extraction**: Identify tool calls and map to human actions
3. **Status Formatting**: Clean, emoji-enhanced status messages
4. **Real-time Display**: Stream processed output to console

### Status
⏳ **Not Started** - Waiting for architecture decision on Initiative 1