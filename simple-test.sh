#!/bin/bash

echo "=== Simple Claude CLI Test ==="
echo "Testing if Claude can actually work in the container..."
echo ""

# Just run Claude directly with a simple prompt
docker exec claudo-manager claude \
  -p "Say 'Hello from Claude in Docker!' and use the Read tool to read package.json" \
  --dangerously-skip-permissions

echo ""
echo "=== Test complete ==="