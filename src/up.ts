#!/usr/bin/env node

import { execSync, spawn } from 'child_process';
import { detectTTY, getDockerCommand } from './utils/tty-detector';
import { mkdirSync } from 'fs';
import * as path from 'path';

// Spawn Manager Claude in Docker container with TTY-aware mode
function spawnManager() {
  const containerName = 'claudo-manager';
  
  // Check if container exists and handle appropriately
  try {
    const containerStatus = execSync(`docker inspect -f '{{.State.Status}}' ${containerName} 2>/dev/null`, { 
      encoding: 'utf-8' 
    }).trim();
    
    if (containerStatus === 'running') {
      console.log(`[claudo] Manager is already running in container '${containerName}'.`);
      console.log('[claudo] Use "claudo down" to stop it first, or "claudo logs" to view output.');
      return;
    } else if (containerStatus === 'exited' || containerStatus === 'created') {
      console.log(`[claudo] Removing stopped container '${containerName}'...`);
      execSync(`docker rm ${containerName}`, { stdio: 'ignore' });
    }
  } catch (e) {
    // Container doesn't exist, which is fine
  }
  
  // Ensure .claudo directory exists
  const claudoDir = path.join(process.cwd(), '.claudo');
  mkdirSync(claudoDir, { recursive: true });
  
  // Detect TTY and get appropriate strategy
  const strategy = detectTTY();
  const cmd = getDockerCommand(containerName, strategy);
  
  if (strategy.isInteractive) {
    console.log('[claudo] Spawning Manager with streaming JSON bus (interactive mode)...');
  } else {
    console.log('[claudo] Spawning Manager with streaming JSON bus (detached mode)...');
    console.log('[claudo] Output will be written to .claudo/manager-output.log');
  }
  
  try {
    if (strategy.isInteractive) {
      // Interactive mode - connect stdio directly
      execSync(cmd, { 
        stdio: 'inherit',
        cwd: process.cwd() 
      });
      console.log('[claudo] Manager completed.');
    } else {
      // Detached mode - start in background
      const containerId = execSync(cmd, { encoding: 'utf-8', cwd: process.cwd() }).trim();
      console.log(`[claudo] Manager started (${containerId.substring(0, 12)}).`);
      console.log('[claudo] Use "claudo logs" to view output or "claudo down" to stop.');
      
      // Wait a moment for the container to start generating output
      console.log('[claudo] Waiting for output...\n');
      
      // Use docker logs as the primary method
      setTimeout(() => {
        const logsProcess = spawn('docker', ['logs', '-f', containerName], {
          stdio: 'inherit'
        });
        
        setTimeout(() => {
          logsProcess.kill();
          console.log('\n[claudo] Manager is running in background. Use "claudo logs" to see more.');
        }, 5000);
      }, 1000); // Wait 1 second for container to start
    }
  } catch (error: any) {
    if (error.message.includes('Unable to find image')) {
      console.error('[claudo] Error: Docker image "claudo-container" not found.');
      console.error('[claudo] Please build the image first with:');
      console.error('  cd /path/to/full-claudo && docker build -t claudo-container docker/');
    } else if (error.message.includes('the input device is not a TTY')) {
      console.error('[claudo] Error: TTY detection failed. This should not happen.');
      console.error('[claudo] Please report this issue.');
    } else {
      console.error('[claudo] Error starting manager:', error.message);
    }
    process.exit(1);
  }
}

spawnManager();