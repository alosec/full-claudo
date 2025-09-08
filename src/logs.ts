#!/usr/bin/env node

import { spawn, execSync } from 'child_process';
import { existsSync } from 'fs';
import * as path from 'path';

// Handle claudo logs command - intelligently choose between attach and tail
function showLogs() {
  const containerName = 'claudo-manager';
  const outputFile = path.join(process.cwd(), '.claudo', 'manager-output.log');
  
  // Check if container is running
  let containerRunning = false;
  let isInteractive = false;
  
  try {
    const containerStatus = execSync(`docker inspect -f '{{.State.Status}}' ${containerName} 2>/dev/null`, { 
      encoding: 'utf-8' 
    }).trim();
    
    containerRunning = containerStatus === 'running';
    
    if (containerRunning) {
      // Check if container was started with -it (interactive)
      const containerConfig = execSync(`docker inspect -f '{{.Config.AttachStdout}}' ${containerName} 2>/dev/null`, { 
        encoding: 'utf-8' 
      }).trim();
      
      isInteractive = containerConfig === 'true';
    }
  } catch (e) {
    // Container doesn't exist
  }
  
  if (containerRunning) {
    // Container is running - use docker logs (works for both interactive and detached)
    console.log(`[claudo] Showing logs for ${containerName}...`);
    console.log('[claudo] Press Ctrl+C to stop.');
    
    const logsProcess = spawn('docker', ['logs', '-f', containerName], {
      stdio: 'inherit',
      shell: false
    });
    
    logsProcess.on('error', (error: any) => {
      console.error('[claudo] Error getting logs:', error.message);
      process.exit(1);
    });
    
    logsProcess.on('close', (code) => {
      process.exit(code || 0);
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n[claudo] Stopping logs...');
      logsProcess.kill('SIGINT');
    });
    
  } else if (existsSync(outputFile)) {
    // Use file output (for detached mode or when container is stopped)
    console.log(`[claudo] Tailing output from ${outputFile}...`);
    console.log('[claudo] Press Ctrl+C to stop.');
    
    const args = process.argv.slice(2);
    const tailArgs = ['-f'];
    
    // Handle --tail flag
    const tailIndex = args.findIndex(arg => arg === '--tail');
    if (tailIndex !== -1 && args[tailIndex + 1]) {
      tailArgs.push('-n', args[tailIndex + 1]);
    } else if (!args.includes('-f') && !args.includes('--follow')) {
      // Show last 50 lines by default if not following
      tailArgs.push('-n', '50');
      tailArgs.splice(tailArgs.indexOf('-f'), 1); // Remove -f
    }
    
    tailArgs.push(outputFile);
    
    const tailProcess = spawn('tail', tailArgs, {
      stdio: 'inherit',
      shell: false
    });
    
    tailProcess.on('error', (error: any) => {
      if (error.message.includes('ENOENT')) {
        console.error('[claudo] Error: tail command not found.');
      } else {
        console.error('[claudo] Error reading logs:', error.message);
      }
      process.exit(1);
    });
    
    tailProcess.on('close', (code) => {
      process.exit(code || 0);
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n[claudo] Stopping log tail...');
      tailProcess.kill('SIGINT');
    });
    
  } else {
    // No container and no output file
    console.error('[claudo] No logs available.');
    console.error('[claudo] Manager is not running and no output file found.');
    console.error('[claudo] Use "claudo up" to start the manager first.');
    process.exit(1);
  }
}

showLogs();