# Current Blockers & Initiatives

## 🚧 Initiative 1: Docker-in-Docker Architecture Problem (HIGH PRIORITY)

### Problem
The current architecture has a fundamental flaw:
```
Host System
└── Docker Container (claudo-manager)
    └── Manager Claude tries to run: `docker run claudo-container ...`
       └── ERROR: /bin/sh: docker: not found
```

Manager runs inside Docker but needs to spawn other agents in separate Docker containers. This requires Docker-in-Docker which isn't currently set up.

### Impact
- Manager can initialize projects, read tasks, create memory-bank files
- Manager **CANNOT** spawn Planner/Worker/Critic agents
- Multi-agent workflow is blocked at the critical handoff point

### Solution Options

#### Option 1: Docker-in-Docker (DinD)
**Pros:**
- Maintains container isolation for all agents
- Keeps current architecture mostly intact

**Cons:**
- Complex setup (install Docker in container)
- Security concerns with socket mounting
- Heavier resource usage

**Implementation:**
```dockerfile
# Add to Dockerfile
RUN apk add --no-cache docker
# Add to docker run command
-v /var/run/docker.sock:/var/run/docker.sock
```

#### Option 2: Host-level Agent Spawning
**Pros:**  
- Clean separation - Manager coordinates, Host executes
- Better security model

**Cons:**
- More complex communication mechanism
- Requires host-side daemon/script

**Implementation:**
- Manager writes spawn requests to shared volume
- Host script monitors and spawns containers
- Results communicated back via filesystem

#### Option 3: All-in-One Container
**Pros:**
- Simplest to implement
- No Docker-in-Docker complexity

**Cons:**
- Less isolation between agents
- Potential resource conflicts

**Implementation:**
- Run all agents as separate processes in same container
- Use process isolation instead of container isolation

#### Option 4: Host-based Manager  
**Pros:**
- Manager has native Docker access
- Agents still get container isolation

**Cons:**
- Manager not sandboxed
- More complex installation

**Implementation:**
- Manager runs as native Node.js process on host
- Only Planner/Worker/Critic run in containers

### Decision Criteria
- **Simplicity**: How easy to implement and maintain?
- **Security**: How well does it isolate potentially dangerous code execution?
- **Resource Usage**: How efficient is it?
- **Reliability**: How likely is it to work across different systems?

### Status
⏳ **Decision Pending** - Need to evaluate trade-offs and choose approach

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