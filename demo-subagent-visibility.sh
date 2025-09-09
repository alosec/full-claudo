#!/bin/bash

# Demo script to show subagent visibility working

echo "================================="
echo "  SUBAGENT VISIBILITY DEMO"
echo "================================="
echo

echo "This demo shows how 'claudo logs -f' can monitor subagent activity"
echo "even when the Manager container is not running."
echo
echo "Press Enter to continue..."
read

# Clean up old session files
echo "→ Cleaning up old session metadata..."
rm -f .claudo/*-metadata.json 2>/dev/null
echo

# Terminal 1 simulation
echo "TERMINAL 1: Starting logs monitor in standalone mode"
echo "$ claudo logs --standalone"
echo
echo "(In a real scenario, this would run in a separate terminal)"
echo "Starting monitor in background..."
node dist/src/logs.js --standalone &
LOGS_PID=$!
sleep 2
echo "✓ Monitor started (PID: $LOGS_PID)"
echo

# Terminal 2 simulation
echo "TERMINAL 2: Manager spawning a Planner agent"
echo "$ node dist/src/agent.js plan 'Create a test feature'"
echo
echo "Spawning agent..."
node dist/src/agent.js plan "Create a test feature" > agent-output.txt 2>&1 &
AGENT_PID=$!

# Wait for agent to start and create session
sleep 3

# Check if metadata was created
if [ -f .claudo/plan-metadata.json ]; then
    echo "✓ Session metadata captured:"
    cat .claudo/plan-metadata.json | jq '.sessionId, .timestamp' 
    echo
    
    SESSION_FILE=$(cat .claudo/plan-metadata.json | jq -r '.sessionFile')
    if [ -f "$SESSION_FILE" ]; then
        echo "✓ Session file created: $SESSION_FILE"
        echo "  Size: $(wc -c < "$SESSION_FILE") bytes"
        echo "  Lines: $(wc -l < "$SESSION_FILE")"
        echo
    fi
else
    echo "⚠ Session metadata not found"
fi

# Wait for agent to complete
echo "Waiting for agent to complete..."
wait $AGENT_PID
echo "✓ Agent completed"
echo

# Show what the agent produced
echo "Agent output summary:"
echo "---"
head -5 agent-output.txt
echo "..."
tail -2 agent-output.txt
echo "---"
echo

# Clean up
echo "Cleaning up..."
kill $LOGS_PID 2>/dev/null
rm -f agent-output.txt

echo
echo "================================="
echo "  DEMO COMPLETE"
echo "================================="
echo
echo "Key takeaways:"
echo "1. Subagent sessions are automatically captured using stream-json format"
echo "2. Metadata files (.claudo/*-metadata.json) contain session details"
echo "3. 'claudo logs --standalone' can monitor subagents without Manager"
echo "4. Session files are stored in ~/.claude/projects/[project-name]/"
echo
echo "To use in practice:"
echo "  Terminal 1: claudo logs -f    (or --standalone if no Manager)"
echo "  Terminal 2: Manager spawns agents and logs show their activity"