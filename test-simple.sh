#!/bin/bash

# Simple test - just run Claude in container to see what happens

cd /home/alex/code/full-claudo

echo "Testing simple Claude container with credentials..."

docker run --rm \
  -v "$(pwd):/workspace" \
  -v "$HOME/.claude/.credentials.json:/home/node/.claude/.credentials.json:ro" \
  -v "$HOME/.claude/settings.json:/home/node/.claude/settings.json:ro" \
  claudo-container \
  claude -p "Hello! Can you read files in the current directory? Use Read tool to check what's here." \
  --dangerously-skip-permissions