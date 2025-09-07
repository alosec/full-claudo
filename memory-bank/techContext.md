# Technical Context

## Technology Stack

**Runtime**: Node.js with TypeScript
**Container**: Docker with Claude CLI
**Communication**: Shell process spawning
**State**: File-based (memory-bank/ directory)

## Dependencies

```json
{
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}
```

## Build Process

- TypeScript compilation to `dist/` directory
- `claudo` bash script routes to compiled JS modules
- Docker container pre-built with Claude CLI

## Docker Configuration

**Container**: `claudo-container`
- Base: Node.js with Claude CLI installed
- Volume mounts:
  - `/workspace` (project files)
  - `~/.claude/.credentials.json:ro` (Claude credentials)
  - `~/.claude/settings.json:ro` (Claude settings)
- Environment: PATH includes /workspace for claudo command access

## File Permissions

- Manager container runs as named container: `claudo-manager`
- Agent containers run as ephemeral (--rm)
- All containers use `--dangerously-skip-permissions` for Claude CLI

## Known Technical Issues

1. **Shell Environment**: Current environment lacks proper Posix shell
   - Error: "No suitable shell found. Claude CLI requires a Posix shell environment"
   - May need SHELL environment variable set
   
2. **Container Build Status**: Need to verify Docker container exists
   - Container name: `claudo-container`
   - Should include working Claude CLI installation

## Development Commands

- `npm run build`: Compile TypeScript to dist/
- `./claudo up`: Start Manager container
- `./claudo down`: Stop Manager container  
- `./claudo plan/worker/critic/oracle "<task>"`: Spawn agents

## Testing Strategy

1. Verify Docker container build
2. Test Manager spawning
3. Test agent communication
4. Validate end-to-end workflow with sample task