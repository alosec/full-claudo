#!/usr/bin/env node

import { spawn } from 'child_process';

// Handle claudo logs command with Docker logs integration
function showLogs() {
  const containerName = 'claudo-manager';
  const args = process.argv.slice(2);
  
  // Parse arguments for Docker logs options
  const dockerArgs = ['logs'];
  
  // Handle follow flag
  if (args.includes('-f') || args.includes('--follow')) {
    dockerArgs.push('--follow');
  }
  
  // Handle tail flag
  const tailIndex = args.findIndex(arg => arg === '--tail');
  if (tailIndex !== -1 && args[tailIndex + 1]) {
    dockerArgs.push('--tail', args[tailIndex + 1]);
  }
  
  // Handle timestamps flag if needed
  if (args.includes('-t') || args.includes('--timestamps')) {
    dockerArgs.push('--timestamps');
  }
  
  // Add container name
  dockerArgs.push(containerName);
  
  console.log(`[claudo] Showing logs for ${containerName}...`);
  
  // Spawn docker logs process
  const logsProcess = spawn('docker', dockerArgs, {
    stdio: 'inherit',
    shell: false
  });
  
  // Handle process events
  logsProcess.on('error', (error) => {
    if (error.message.includes('ENOENT')) {
      console.error('[claudo] Error: Docker not found. Please ensure Docker is installed and running.');
    } else {
      console.error('[claudo] Error accessing logs:', error.message);
    }
    process.exit(1);
  });
  
  logsProcess.on('close', (code) => {
    if (code === 1) {
      console.error(`[claudo] Error: Container '${containerName}' not found or not running.`);
      console.error('[claudo] Use "claudo up" to start the manager first.');
    }
    process.exit(code || 0);
  });
  
  // Handle graceful shutdown for follow mode
  process.on('SIGINT', () => {
    console.log('\n[claudo] Stopping logs...');
    logsProcess.kill('SIGINT');
  });
  
  process.on('SIGTERM', () => {
    console.log('\n[claudo] Stopping logs...');
    logsProcess.kill('SIGTERM');
  });
}

showLogs();