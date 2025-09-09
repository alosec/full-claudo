# System Architecture & Patterns

## Core Architecture

**Multi-Agent Pattern**: 5 specialized Claude instances with distinct roles
- Manager: Long-running orchestrator (this instance)
- Planner: Strategic task analysis and breakdown
- Worker: Code implementation (only agent authorized to edit files)
- Critic: Quality review and validation  
- Oracle: Strategic guidance when stuck

**Communication Pattern**: Clean agent spawning with session monitoring
- Manager uses Bash tool to spawn: `claudo plan/worker/critic/oracle`
- Agents return clean text responses (no streaming JSON pollution)
- Session IDs captured automatically for user visibility
- `claudo logs -f` monitors both Manager and subagent sessions

## Key Design Principles

1. **Simplicity**: ~100 lines of TypeScript total
2. **Security**: All agents run in Docker sandboxes with `--dangerously-skip-permissions`
3. **Minimal State**: Manager coordinates, memory-bank/ provides persistence
4. **Unix Philosophy**: Text files for communication and queuing

## Data Flow

### GTD-Style English → Code Compilation
```
planning/inbox/feature.md (user drops raw request)
    → Manager reads inbox item
    → Creates planning/features/[feature]/INDEX.md
    → Planner creates planning/features/[feature]/plan.md
    → Worker implements per plan.md
    → Critic validates implementation
    → Manager moves to planning/docs/YYYY-MM-DD-feature.md
    → Git commit with working code
    → Next inbox item
```

### Traditional Task Flow
```
Task Queue (.claudo/queue.txt) 
    → Manager reads task
    → Planner creates strategy in planning/tasks/
    → Worker implements changes
    → Critic validates result
    → Manager updates memory-bank/
    → Git commit
    → Next task
```

## File Structure

```
/workspace/
├── claudo                 # Entry script (bash router)
├── src/                   # TypeScript modules
│   ├── up.ts             # Spawn Manager in Docker
│   ├── down.ts           # Kill Manager container  
│   └── agent.ts          # Spawn other agents
├── prompts/              # Agent-specific prompts
├── memory-bank/          # Project state management
├── .claudo/              # Task queue and temp files
└── docker/               # Container configuration
```

## Agent Communication Architecture

### Session Management
- Agent spawning via corrected `src/agent.ts` with `/workspace/prompts/` paths
- Session IDs captured from Claude's verbose output and stored in `.claudo/[agent]-session.txt`
- Clean text responses returned to Manager (no streaming JSON context pollution)
- User visibility via `claudo logs -f` which auto-detects and tails new sessions

### Log Monitoring Flow
```
Manager calls: claudo plan "task"
    ↓
agent.ts captures session ID → .claudo/plan-session.txt
    ↓
logs.ts detects new session ID → tails ~/.claude/projects/.../[session-id].jsonl
    ↓
User sees: [Planner] → Tool calls and responses via stream parser
Manager gets: Clean final text response only
```

## Security Model

- All Claude instances run in isolated Docker containers
- Read-only credential mounting from host ~/.claude/
- Workspace volume mounted for file access
- Worker is only agent allowed to edit code files
- `--dangerously-skip-permissions` for sandbox execution