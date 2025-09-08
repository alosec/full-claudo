#!/bin/bash

echo "=== Testing Worker agent directly ==="
echo "Task: Add a test comment to package.json"
echo ""

# Run worker agent with simple task
docker exec claudo-manager bash -c 'cd /workspace && node /usr/local/lib/claudo/dist/agent.js worker "Add a comment at the top of package.json that says: // Test comment from Worker agent"'

echo ""
echo "=== Worker agent test complete ==="