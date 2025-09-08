#!/usr/bin/env node

import { spawn } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, createWriteStream } from 'fs';
import * as path from 'path';

// Run Manager Claude within container - simplified to only output raw JSON
function runManager() {
  const workDir = '/workspace';
  const claudoDir = path.join(workDir, '.claudo');
  const managerSystemPrompt = path.join(workDir, 'prompts', 'manager.md');
  
  // Ensure .claudo directory exists
  try {
    mkdirSync(claudoDir, { recursive: true });
  } catch (e) {}
  
  // Prepare the prompt
  const systemPrompt = readFileSync(managerSystemPrompt, 'utf-8');
  const taskPrompt = 'Act as Manager Claude and coordinate the work.';
  const fullPrompt = `${taskPrompt}\n\n---\n\n${systemPrompt}`;
  
  // Save prompt for debugging
  const promptFile = path.join(claudoDir, 'manager-prompt.txt');
  writeFileSync(promptFile, fullPrompt);
  console.log('[claudo] DEBUG: Prompt file saved to:', promptFile);
  console.log('[claudo] DEBUG: Prompt length:', fullPrompt.length);
  
  // Build the command to pipe prompt to claude
  const command = `cat "${promptFile}" | claude --dangerously-skip-permissions --output-format stream-json --input-format text --verbose --model sonnet`;
  
  console.log('[claudo] DEBUG: Executing command via bash -c');
  console.log('[claudo] DEBUG: Command:', command);
  
  // Spawn the command in container context
  const manager = spawn('bash', ['-c', command], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      CLAUDE_OUTPUT_FORMAT: 'stream-json',
      NODE_ENV: 'production'
    }
  });
  
  // Set up output logging to capture clean JSON stream
  const outputLogPath = path.join(claudoDir, 'manager-output.jsonl');
  const outputStream = createWriteStream(outputLogPath, { flags: 'a' });
  console.log('[claudo] DEBUG: Raw JSON will be logged to', outputLogPath);
  
  // Output raw JSON directly to stdout and save to output file
  // No parsing - let the host-based parser handle it
  manager.stdout.pipe(process.stdout);
  manager.stdout.pipe(outputStream);
  
  // Handle process events
  manager.on('error', (error) => {
    console.error('[claudo] Manager error:', error);
  });
  
  manager.stderr.on('data', (data) => {
    console.error('[claudo] Manager stderr:', data.toString());
  });
  
  manager.on('close', (code) => {
    console.log(`[claudo] Manager process exited with code ${code}`);
    outputStream.end();
  });
  
  // Handle container termination
  process.on('SIGINT', () => {
    console.log('[claudo] Stopping Manager...');
    manager.kill('SIGTERM');
    setTimeout(() => {
      manager.kill('SIGKILL');
      process.exit(0);
    }, 5000);
  });
  
  process.on('SIGTERM', () => {
    console.log('[claudo] Terminating Manager...');
    manager.kill('SIGTERM');
  });
}

// Check if run directly or imported
if (require.main === module) {
  console.log('[claudo] Starting Manager with streaming JSON bus...');
  runManager();
}