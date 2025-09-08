#!/usr/bin/env node

import { spawn, execSync } from 'child_process';
import { HostDockerParser } from './host-parser';

// Handle claudo logs command - simplified to use host-based parser
function showLogs() {
  const containerName = 'claudo-manager';
  
  // Check if container exists
  let containerExists = false;
  
  try {
    const containerStatus = execSync(`docker inspect -f '{{.State.Status}}' ${containerName} 2>/dev/null`, { 
      encoding: 'utf-8' 
    }).trim();
    
    containerExists = true;
    
    if (containerStatus === 'running') {
      console.log(`[claudo] Showing live parsed output for ${containerName}...`);
      console.log('[claudo] Press Ctrl+C to stop.');
      
      // Use host-based parser for live output with parsing
      const parser = new HostDockerParser(containerName, 'Manager');
      parser.start().catch((error) => {
        console.error('[claudo] Parser failed:', error.message);
        console.log('[claudo] Falling back to raw docker logs...');
        showRawLogs(containerName);
      });
      
    } else {
      console.log(`[claudo] Container ${containerName} is not running (${containerStatus}).`);
      console.log('[claudo] Showing historical logs...');
      showRawLogs(containerName);
    }
    
  } catch (e) {
    // Container doesn't exist
    console.error('[claudo] No logs available.');
    console.error('[claudo] Manager container not found.');
    console.error('[claudo] Use "claudo up" to start the manager first.');
    process.exit(1);
  }
}

// Fallback to raw docker logs without parsing
function showRawLogs(containerName: string) {
  const args = process.argv.slice(2);
  const logsArgs = ['logs'];
  
  // Handle common flags
  if (!args.includes('--tail')) {
    logsArgs.push('--tail', '100'); // Show last 100 lines by default
  }
  
  // Add any user flags
  logsArgs.push(...args);
  logsArgs.push(containerName);
  
  const logsProcess = spawn('docker', logsArgs, {
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
}

showLogs();