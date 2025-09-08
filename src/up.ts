#!/usr/bin/env node

import { execSync, spawn } from 'child_process';
import { mkdirSync } from 'fs';
import * as path from 'path';
import { HostDockerParser } from './host-parser';
import { DockerManager } from './docker-manager';
import { ensureDockerAvailable, getContainerStatus, removeContainer } from './utils/docker-utils';

// Spawn Manager Claude in Docker container - with auto-build support
async function spawnManager() {
  const containerName = 'claudo-manager';
  
  // Ensure Docker is available
  if (!ensureDockerAvailable()) {
    process.exit(1);
  }

  // Initialize Docker manager
  const dockerManager = new DockerManager();
  
  // Ensure Docker image exists (auto-build if missing)
  const imageReady = await dockerManager.ensureImage(true);
  if (!imageReady) {
    console.error('[claudo] Failed to prepare Docker image.');
    process.exit(1);
  }
  
  // Check if container exists and handle appropriately
  const containerStatus = getContainerStatus(containerName);
  
  if (containerStatus === 'running') {
    console.log(`[claudo] Manager is already running in container '${containerName}'.`);
    console.log('[claudo] Use "claudo down" to stop it first, or "claudo logs" to view output.');
    return;
  } else if (containerStatus === 'exited' || containerStatus === 'created') {
    console.log(`[claudo] Removing stopped container '${containerName}'...`);
    removeContainer(containerName);
  }
  
  // Ensure .claudo directory exists
  const claudoDir = path.join(process.cwd(), '.claudo');
  mkdirSync(claudoDir, { recursive: true });
  
  // Always use detached mode - simple approach
  const cmd = `docker run -d --name ${containerName} \
    -v "$(pwd):/workspace" \
    -v "$HOME/.claude/.credentials.json:/home/node/.claude/.credentials.json:ro" \
    -v "$HOME/.claude/settings.json:/home/node/.claude/settings.json:ro" \
    -w /workspace \
    claudo-container \
    node /workspace/dist/src/manager-runner.js`;
  
  console.log('[claudo] Starting Manager in detached mode...');
  
  try {
    // Start container in detached mode
    const containerId = execSync(cmd, { encoding: 'utf-8', cwd: process.cwd() }).trim();
    console.log(`[claudo] Manager started (${containerId.substring(0, 12)}).`);
    
    // Wait a moment for container to start
    console.log('[claudo] Waiting for container to start...\n');
    setTimeout(() => {
      // Start host-based parser to show live output
      const parser = new HostDockerParser(process.cwd(), 'Manager');
      parser.start().catch((error) => {
        console.error('[claudo] Parser failed:', error.message);
        console.log('[claudo] Use "claudo logs" to view output manually.');
      });
    }, 2000);
    
  } catch (error: any) {
    console.error('[claudo] Error starting manager:', error.message);
    process.exit(1);
  }
}

spawnManager();