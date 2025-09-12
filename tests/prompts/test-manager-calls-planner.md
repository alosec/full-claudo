# Test: Manager Calls Planner

This is a test to verify the Manager can successfully spawn a Planner agent within the Docker container.

Your task:
1. First respond: "MANAGER: Starting planner test"
2. Use the Bash tool to spawn a Planner agent with this exact command:
   ```
   node /workspace/dist/src/agent.js plan --print "Create a haiku about planning" 2>&1
   ```
3. Capture the Planner's response from the command output
4. After receiving the response, respond: "MANAGER: Received planner response: [include the actual haiku]"
5. Then exit

Important:
- The Planner agent should run in the same Docker container
- Use the Bash tool to execute the spawn command
- The Planner's output will be the text response (not JSON)
- Include the actual Planner response in your final message