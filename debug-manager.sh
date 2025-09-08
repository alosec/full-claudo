#!/bin/bash

echo "=== Running Manager without streaming parser ==="
echo "=== This will show raw JSON output ==="
echo ""

docker exec claudo-manager bash -c 'cat /workspace/.claudo/manager-prompt.txt | claude --dangerously-skip-permissions --output-format stream-json --input-format text --verbose --model sonnet 2>&1 | head -100'

echo ""
echo "=== First 100 lines of raw output shown ==="