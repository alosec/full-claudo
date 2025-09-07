#!/usr/bin/env node

import { execSync } from 'child_process';

// Spawn Manager Claude in Docker container with new streaming architecture
function spawnManager() {
  const containerName = 'claudo-manager';
  
  // Kill existing manager if running
  try {
    execSync(`docker kill ${containerName} 2>/dev/null`, { stdio: 'ignore' });
  } catch (e) {
    // Container not running, that's fine
  }
  
  // Build TypeScript files first
  console.log('[claudo] Building TypeScript files...');
  execSync('npm run build', { stdio: 'inherit', cwd: process.cwd() });
  
  // Start new manager container with streaming JSON architecture
  const cmd = `docker run -d --name ${containerName} \\
    -v "$(pwd):/workspace" \\
    -v "$HOME/.claude/.credentials.json:/home/node/.claude/.credentials.json:ro" \\
    -v "$HOME/.claude/settings.json:/home/node/.claude/settings.json:ro" \\
    -e PATH="/workspace:/usr/local/lib/claudo/dist:\$PATH" \\
    -w /workspace \\
    claudo-container \\
    node /usr/local/lib/claudo/dist/manager-runner.js`;
  
  console.log('[claudo] Spawning Manager with streaming JSON bus...');
  execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
  console.log('[claudo] Manager started. Use "claudo down" to stop.');
}

spawnManager();