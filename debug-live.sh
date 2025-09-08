#!/bin/bash

echo "=== Attaching to live Manager Claude output ==="
echo "=== Showing last 200 lines of streaming JSON ==="
echo ""

# Get the process ID of the claude process
CLAUDE_PID=$(docker exec claudo-manager pgrep -f "claude --dangerously")

if [ -z "$CLAUDE_PID" ]; then
  echo "Claude process not found!"
  exit 1
fi

echo "Found Claude process: PID $CLAUDE_PID"
echo ""

# Try to get output from the process
docker exec claudo-manager bash -c "timeout 5 strace -p $CLAUDE_PID -s 1000 2>&1 | grep -E 'write|read' | head -20"