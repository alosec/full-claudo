#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, mkdirSync } from 'fs';
import * as path from 'path';

// Spawn Manager Claude in Docker container
function spawnManager() {
  const prompt = readFileSync('/usr/local/lib/claudo/prompts/manager.md', 'utf8');
  const containerName = 'claudo-manager';
  
  // Kill existing manager if running
  try {
    execSync(`docker kill ${containerName} 2>/dev/null`, { stdio: 'ignore' });
  } catch (e) {
    // Container not running, that's fine
  }

  // Ensure .claudo directory exists
  const claudoDir = path.join(process.cwd(), '.claudo');
  mkdirSync(claudoDir, { recursive: true });
  
  // Write prompt to temporary file to avoid shell escaping issues
  const tempPromptFile = path.join(claudoDir, 'manager-prompt.txt');
  require('fs').writeFileSync(tempPromptFile, prompt);
  
  // Start new manager container
  const cmd = `docker run -d --name ${containerName} \\
    -v "$(pwd):/workspace" \\
    -v "$HOME/.claude/.credentials.json:/home/node/.claude/.credentials.json:ro" \\
    -v "$HOME/.claude/settings.json:/home/node/.claude/settings.json:ro" \\
    -e PATH="/workspace:\$PATH" \\
    claudo-container \\
    sh -c 'claude -p "$(cat /workspace/.claudo/manager-prompt.txt)" --dangerously-skip-permissions --output-format stream-json --verbose --model sonnet'`;
  
  console.log('[claudo] Spawning Manager in Docker...');
  execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
  console.log('[claudo] Manager started. Use "claudo down" to stop.');
}

spawnManager();