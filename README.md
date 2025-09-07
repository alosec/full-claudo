# Full Claudo

Simple multi-agent Claude system for automated software development.

## Quick Start

```bash
# Build the project
npm install && npm run build

# Build Docker container
docker build -t claudo-container ./docker

# Start the Manager
./claudo up

# Stop the Manager  
./claudo down
```

## Architecture

- **Manager**: Long-running Claude that orchestrates other agents
- **Planner**: Creates implementation plans for tasks
- **Worker**: Executes code changes (only agent that can edit files)
- **Critic**: Reviews plans and implementations
- **Oracle**: Provides strategic guidance when stuck

## Usage

1. Add tasks to `.claudo/queue.txt`
2. Run `./claudo up` to start the Manager
3. Manager will read tasks and spawn other agents as needed
4. All work is saved to git automatically

## Task Queue Format

Simple text file with one task per line:
```
- Change index bg to purple
- Add user login form
- Fix navigation bug
```

## Agent Communication

Manager uses Bash tool to spawn other agents:
- `claudo plan "<task>"` - Strategic planning
- `claudo worker "<task>"` - Implementation  
- `claudo critic "<task>"` - Review/validation
- `claudo oracle "<task>"` - Strategic advice

Total infrastructure: ~100 lines of TypeScript + Docker container.