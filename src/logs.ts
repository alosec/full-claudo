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
      // Check for agent metadata files (new enhanced format)
      const sessionTypes = ['plan', 'worker', 'critic', 'oracle'];
      
      sessionTypes.forEach(agentType => {
        // First try new metadata format
        const metadataFile = path.join(claudoDir, `${agentType}-metadata.json`);
        let sessionLogFile: string | null = null;
        let sessionId: string | null = null;
        
        try {
          // Try to read the enhanced metadata file
          const metadata = JSON.parse(readFileSync(metadataFile, 'utf8'));
          sessionId = metadata.sessionId;
          sessionLogFile = metadata.sessionFile;
          
          // Validate the session file exists
          if (sessionLogFile) {
            statSync(sessionLogFile);
          }
        } catch {
          // Fall back to old format if metadata doesn't exist
          const sessionFile = path.join(claudoDir, `${agentType}-session.txt`);
          const projectFile = path.join(claudoDir, `${agentType}-project.txt`);
          
          try {
            sessionId = readFileSync(sessionFile, 'utf8').trim();
            
            // Try to get project path or use default
            let projectPath = sessionDir;
            try {
              projectPath = readFileSync(projectFile, 'utf8').trim();
            } catch {
              // Use default sessionDir if project path not found
            }
            
            sessionLogFile = path.join(projectPath, `${sessionId}.jsonl`);
            
            // Validate the session file exists
            if (sessionLogFile) {
              statSync(sessionLogFile);
            }
          } catch {
            // Neither format available or session file doesn't exist
            return;
          }
        }
        
        // Check if this session log exists and we haven't watched it yet
        if (sessionId && sessionLogFile && !watchedSessions.has(sessionId)) {
          try {
            watchedSessions.add(sessionId);
            
            console.log(`[claudo] 🔄 Monitoring ${agentType} agent session (${sessionId.substring(0, 8)}...)`);
            
            // Tail the specific session file with parsing
            const tail = spawn('tail', ['-f', sessionLogFile], { stdio: 'pipe' });
            const parser = new ClaudeStreamParser({
              agentName: agentType.charAt(0).toUpperCase() + agentType.slice(1),
              useColors: true
            });
            
            tail.stdout.pipe(parser);
            
            tail.on('close', () => {
              console.log(`[claudo] ✓ ${agentType.charAt(0).toUpperCase() + agentType.slice(1)} agent completed`);
            });
            
            tail.on('error', (err) => {
              console.error(`[claudo] Failed to tail ${agentType} session: ${err.message}`);
            });
            
          } catch (e) {
            // Session log file doesn't exist yet, will check again next interval
            if (process.env.DEBUG_AGENT) {
              console.error(`[claudo-debug] Failed to monitor ${agentType}: ${e}`);
            }
          }
        }
      });
      
    } catch (e) {
      // Ignore errors in monitoring
      if (process.env.DEBUG_AGENT) {
        console.error(`[claudo-debug] Monitor error: ${e}`);
      }
    }
  }, 1000); // Check every second for faster response
}

// Handle claudo logs command - simplified to use host-based parser
function showLogs() {
  const containerName = 'claudo-manager';
  
  // Check for standalone mode (monitoring subagents without Manager)
  const args = process.argv.slice(2);
  const isStandalone = args.includes('--standalone') || args.includes('-s');
  
  if (isStandalone) {
    // Standalone mode: only monitor subagent sessions
    const sessionDir = getSessionDirectory();
    if (sessionDir) {
      console.log('[claudo] Monitoring for subagent sessions (standalone mode)...');
      console.log('[claudo] Press Ctrl+C to stop.');
      monitorSubagentSessions(sessionDir);
      
      // Keep process running
      setInterval(() => {}, 1000);
    } else {
      console.error('[claudo] No Claude project directory found for current workspace.');
      process.exit(1);
    }
    return;
  }
  
  // Normal mode: Monitor Manager + subagents
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
    // Container doesn't exist - offer standalone mode
    console.log('[claudo] Manager container not found.');
    console.log('[claudo] Starting in standalone mode to monitor subagent sessions...');
    
    const sessionDir = getSessionDirectory();
    if (sessionDir) {
      console.log('[claudo] Monitoring for subagent sessions...');
      console.log('[claudo] Press Ctrl+C to stop.');
      monitorSubagentSessions(sessionDir);
      
      // Keep process running
      setInterval(() => {}, 1000);
    } else {
      console.error('[claudo] No Claude project directory found.');
      console.error('[claudo] Use "claudo up" to start the manager.');
      process.exit(1);
    }
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