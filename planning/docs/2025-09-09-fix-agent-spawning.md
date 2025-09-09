# Fix Agent Spawning in Docker Container Environment

## Problem Context

You are the Manager agent running inside the full-claudo Docker container system. The current agent spawning patterns in your system prompt are failing when executed from within the container environment. 

**Current failing patterns:**
- `node /usr/local/lib/claudo/dist/agent.js plan "<task>"`
- `node /usr/local/lib/claudo/dist/agent.js worker "<task>"`
- `node /usr/local/lib/claudo/dist/agent.js critic "<task>"`
- `node /usr/local/lib/claudo/dist/agent.js oracle "<task>"`

## Your Mission

**Experiment and find the correct way to spawn other agents from within the Docker container.**

### Investigation Steps

1. **Environment Discovery:**
   - Check what's actually available in the container: `ls -la /usr/local/lib/claudo/dist/`
   - Verify file paths and permissions
   - Check if the agent.js file exists and is executable
   - Investigate the working directory and PATH

2. **Alternative Spawning Patterns to Test:**
   - Try using the `claudo` command directly: `claudo plan "<task>"`
   - Test absolute paths: `/workspace/claudo plan "<task>"`
   - Check if the compiled TypeScript is in a different location: `/workspace/dist/agent.js`
   - Try running agents as separate processes vs. Docker containers

3. **Debug the Current Implementation:**
   - Run one simple command to see exact error messages
   - Check if Node.js is available and working
   - Verify Claude CLI is accessible from the spawned process
   - Test if permissions are correctly set

4. **Document Working Solution:**
   - Once you find a working pattern, test it with all agent types
   - Update your understanding of the correct spawning commands
   - Provide clear documentation of what works and why

## Success Criteria

- Successfully spawn a Planner agent and get a response
- Successfully spawn a Worker agent and get a response  
- Successfully spawn a Critic agent and get a response
- Successfully spawn an Oracle agent and get a response
- Document the correct pattern for future use

## Important Notes

- You're inside a Docker container, so file paths may differ from host system
- The container should have Claude CLI available and authenticated
- All agents should run in the same container environment for simplicity
- Use the Bash tool extensively to explore and test different approaches
- Be methodical - test one thing at a time and document results

## Expected Outcome

Update the system knowledge with the correct agent spawning pattern that works from within the Docker container, enabling full autonomous multi-agent orchestration.