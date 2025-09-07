# System Architecture & Patterns

## Core Architecture

**Multi-Agent Pattern**: 5 specialized Claude instances with distinct roles
- Manager: Long-running orchestrator (this instance)
- Planner: Strategic task analysis and breakdown
- Worker: Code implementation (only agent authorized to edit files)
- Critic: Quality review and validation  
- Oracle: Strategic guidance when stuck

**Communication Pattern**: Process spawning via shell commands
- Manager uses Bash tool to spawn: `claudo plan/worker/critic/oracle`
- No complex message passing - simple process execution
- Results captured via stdio

## Key Design Principles

1. **Simplicity**: ~100 lines of TypeScript total
2. **Security**: All agents run in Docker sandboxes with `--dangerously-skip-permissions`
3. **Minimal State**: Manager coordinates, memory-bank/ provides persistence
4. **Unix Philosophy**: Text files for communication and queuing

## Data Flow

```
Task Queue (.claudo/queue.txt) 
    → Manager reads task
    → Planner creates strategy  
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

## Security Model

- All Claude instances run in isolated Docker containers
- Read-only credential mounting from host ~/.claude/
- Workspace volume mounted for file access
- Worker is only agent allowed to edit code files
- `--dangerously-skip-permissions` for sandbox execution