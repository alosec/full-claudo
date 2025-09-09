#!/usr/bin/env node

import { spawn, execSync } from 'child_process';
import { HostDockerParser } from './host-parser';
import { readdirSync, statSync, readFileSync } from 'fs';
import * as path from 'path';

// Get the project-specific Claude session directory
function getSessionDirectory(): string | null {
  const claudeDir = path.join(process.env.HOME || '', '.claude', 'projects');
  const currentDir = process.cwd();
  
  // Generate expected directory name (Claude uses sanitized paths)
  const expectedDirName = currentDir.replace(/\//g, '-');
  const sessionDir = path.join(claudeDir, expectedDirName);
  
  try {
    statSync(sessionDir);
    return sessionDir;
  } catch {
    return null;
  }
}

// Get the most recent session file that's actively being written to
function getActiveSessionFile(sessionDir: string): string | null {
  try {
    const files = readdirSync(sessionDir)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => ({
        name: f,
        path: path.join(sessionDir, f),
        mtime: statSync(path.join(sessionDir, f)).mtime
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    
    return files.length > 0 ? files[0].path : null;
  } catch {
    return null;
  }
}

// Monitor for specific subagent sessions based on captured session IDs
function monitorSubagentSessions(sessionDir: string): void {
  const watchedSessions = new Set<string>();
  const { ClaudeStreamParser } = require('./parser');
  
  // Monitor for session ID files created by agents
  const claudoDir = path.join(process.cwd(), '.claudo');
  
  setInterval(() => {
    try {
      // Check for agent session files
      const sessionTypes = ['plan', 'worker', 'critic', 'oracle'];
      
      sessionTypes.forEach(agentType => {
        const sessionFile = path.join(claudoDir, `${agentType}-session.txt`);
        
        try {
          const sessionId = readFileSync(sessionFile, 'utf8').trim();
          const sessionLogFile = path.join(sessionDir, `${sessionId}.jsonl`);
          
          // Check if this session log exists and we haven't watched it yet
          if (!watchedSessions.has(sessionId)) {
            try {
              statSync(sessionLogFile);
              watchedSessions.add(sessionId);
              
              console.log(`[claudo] 🔄 Monitoring ${agentType} agent session (${sessionId.substr(0, 8)}...)`);
              
              // Tail the specific session file with parsing
              const tail = spawn('tail', ['-f', sessionLogFile], { stdio: 'pipe' });
              const parser = new ClaudeStreamParser(agentType.charAt(0).toUpperCase() + agentType.slice(1));
              
              tail.stdout.pipe(parser);
              
              tail.on('close', () => {
                console.log(`[claudo] ✓ ${agentType.charAt(0).toUpperCase() + agentType.slice(1)} agent completed`);
              });
              
            } catch {
              // Session log file doesn't exist yet, will check again next interval
            }
          }
        } catch {
          // Session file doesn't exist yet
        }
      });
      
    } catch (e) {
      // Ignore errors in monitoring
    }
  }, 1000); // Check every second for faster response
}

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
      
      // Start monitoring for subagent sessions
      const sessionDir = getSessionDirectory();
      if (sessionDir) {
        console.log('[claudo] Monitoring for subagent sessions...');
        monitorSubagentSessions(sessionDir);
      }
      
      // Use host-based parser for live output with parsing
      const parser = new HostDockerParser(process.cwd(), 'Manager');
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