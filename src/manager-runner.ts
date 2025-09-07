#!/usr/bin/env node

import { spawn } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import * as path from 'path';
import { ClaudeStreamParser } from './parser';

// Run Manager Claude within container with streaming output
function runManager() {
  // Read prompt from workspace prompts directory
  const managerPrompt = readFileSync('./prompts/manager.md', 'utf8');
  
  // Ensure .claudo directory exists
  const claudoDir = path.join(process.cwd(), '.claudo');
  mkdirSync(claudoDir, { recursive: true });
  
  // Ensure planning directories exist
  const planningDir = path.join(process.cwd(), 'planning');
  const tasksDir = path.join(planningDir, 'tasks');
  const featuresDir = path.join(planningDir, 'features');
  const workLogDir = path.join(process.cwd(), 'work-log');
  
  mkdirSync(tasksDir, { recursive: true });
  mkdirSync(featuresDir, { recursive: true });
  mkdirSync(workLogDir, { recursive: true });
  
  // Write prompt to temporary file
  const tempPromptFile = path.join(claudoDir, 'manager-prompt.txt');
  writeFileSync(tempPromptFile, managerPrompt);
  
  console.log('[claudo] Starting Manager with streaming JSON bus...');
  console.log('[claudo] DEBUG: Prompt file saved to:', tempPromptFile);
  console.log('[claudo] DEBUG: Prompt length:', managerPrompt.length);
  
  // Use cat to read the file and pipe to claude - avoids shell expansion issues
  const fullCommand = `cat "${tempPromptFile}" | claude --dangerously-skip-permissions --output-format stream-json --input-format text --verbose --model sonnet`;
  
  console.log('[claudo] DEBUG: Executing command via bash -c');
  console.log('[claudo] DEBUG: Command:', fullCommand);
  
  // Spawn Claude Manager process
  const manager = spawn('bash', ['-c', fullCommand], {
    stdio: ['pipe', 'pipe', 'inherit'],
    cwd: process.cwd()
  });
  
  // Set up stream parsing for human-readable output
  const parser = new ClaudeStreamParser('Manager');
  
  // Connect Manager output to parser for human display
  manager.stdout.pipe(parser);
  
  // Handle process events
  manager.on('error', (error) => {
    console.error('[claudo] Manager error:', error);
    process.exit(1);
  });
  
  manager.on('close', (code) => {
    console.log(`[claudo] Manager exited with code ${code}`);
    process.exit(code || 0);
  });
  
  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[claudo] Shutting down Manager...');
    manager.kill('SIGTERM');
  });
  
  process.on('SIGINT', () => {
    console.log('[claudo] Shutting down Manager...');
    manager.kill('SIGINT');
  });
}

runManager();