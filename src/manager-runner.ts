#!/usr/bin/env node

import { spawn } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, createWriteStream } from 'fs';
import * as path from 'path';
import { ClaudeStreamParser } from './parser';

// Run Manager Claude within container with streaming output
function runManager() {
  // Read prompt from container's installed location
  const promptPath = path.join('/usr/local/lib/claudo', 'prompts', 'manager.md');
  const managerPrompt = readFileSync(promptPath, 'utf8');
  
  // Ensure .claudo directory exists
  const claudoDir = path.join(process.cwd(), '.claudo');
  mkdirSync(claudoDir, { recursive: true });
  
  // Ensure planning directories exist
  const planningDir = path.join(process.cwd(), 'planning');
  const tasksDir = path.join(planningDir, 'tasks');
  const featuresDir = path.join(planningDir, 'features');
  const inboxDir = path.join(planningDir, 'inbox');
  const doneDir = path.join(planningDir, 'done');
  const workLogDir = path.join(process.cwd(), 'work-log');
  
  mkdirSync(tasksDir, { recursive: true });
  mkdirSync(featuresDir, { recursive: true });
  mkdirSync(inboxDir, { recursive: true });
  mkdirSync(doneDir, { recursive: true });
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
  
  // Set up debug logging to capture raw JSON
  const debugLogPath = path.join(claudoDir, 'manager-debug.jsonl');
  const debugStream = createWriteStream(debugLogPath, { flags: 'a' });
  console.log('[claudo] DEBUG: Raw JSON will be logged to', debugLogPath);
  
  // Tee the output: send to both parser AND debug file
  manager.stdout.on('data', (chunk) => {
    // Write raw data to debug file
    debugStream.write(chunk);
    // Also send to parser
    parser.write(chunk);
  });
  
  // Add error handling for parser
  parser.on('error', (error) => {
    console.error('[claudo] Parser error:', error);
    console.error('[claudo] Check', debugLogPath, 'for raw output');
  });
  
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