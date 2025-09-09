#!/bin/bash

# Test script to verify subagent visibility works

echo "=== Testing Subagent Visibility ==="
echo

# Clean up old session files
rm -f .claudo/*-metadata.json 2>/dev/null

# Start logs monitoring in background (standalone mode)
echo "1. Starting logs monitor in background (standalone mode)..."
node dist/src/logs.js --standalone > logs-output.txt 2>&1 &
LOGS_PID=$!
sleep 2

# Spawn a test agent
echo "2. Spawning Planner agent..."
node dist/src/agent.js plan "Create a simple hello world test" > /dev/null 2>&1

# Give logs time to pick up the session
echo "3. Waiting for session detection..."
sleep 3

# Check if session was detected
echo "4. Checking logs output..."
if grep -q "Monitoring plan agent session" logs-output.txt; then
    echo "✅ SUCCESS: Planner session detected and monitored!"
else
    echo "❌ FAILED: Planner session not detected"
    echo "Logs output:"
    cat logs-output.txt
fi

# Kill logs monitor
kill $LOGS_PID 2>/dev/null

# Show metadata
echo
echo "5. Session metadata:"
if [ -f .claudo/plan-metadata.json ]; then
    cat .claudo/plan-metadata.json | jq '.'
else
    echo "No metadata file found"
fi

# Clean up
rm -f logs-output.txt

echo
echo "=== Test Complete ==="