# Agent Spawning Patterns

## Key Principle: Avoiding Context Pollution

When the Manager agent spawns other agents (Planner, Worker, Critic), it's crucial to avoid polluting the Manager's context with JSON output from the spawned agents.

## Spawning Patterns

### Manager Spawning Other Agents
When the Manager uses the Bash tool to spawn agents, it should use the `--print` flag to get clean text responses:

```bash
# Good - Clean text response for Manager
node /workspace/dist/src/agent.js plan --print "Create a deployment plan"

# Bad - Pollutes Manager context with JSON
node /workspace/dist/src/agent.js plan "Create a deployment plan"
```

### Direct Agent Invocation
When calling agents directly from the command line or for testing, omit `--print` to get full stream-json output with session tracking:

```bash
# Direct invocation - Full JSON for monitoring
claudo plan "Create a deployment plan"
```

## Implementation Details

1. **agent.ts Detection**: The agent checks for `--print` flag or `CLAUDO_AGENT_PRINT` environment variable
2. **Print Mode**: Uses `claude --print` for single clean response
3. **Stream Mode**: Uses `claude --output-format stream-json --verbose` for session tracking

## Example Manager Prompt

When instructing the Manager to spawn agents, use this pattern:

```markdown
Use the Bash tool to spawn a Planner agent:
node /workspace/dist/src/agent.js plan --print "Your task here"
```

This ensures the Manager receives only the text response, keeping its context clean and focused.