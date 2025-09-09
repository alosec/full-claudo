#!/usr/bin/env node

import { spawn } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, createWriteStream } from 'fs';
import * as path from 'path';

// Run Manager Claude within container - supports both JSON streaming and interactive modes
function runManager() {
  const isInteractive = process.env.CLAUDO_INTERACTIVE === 'true';
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
  console.error('[claudo] DEBUG: Prompt file saved to:', promptFile);
  console.error('[claudo] DEBUG: Prompt length:', fullPrompt.length);
  
  // Build the command based on mode
  let command: string;
  let spawnOptions: any;
  
  if (isInteractive) {
    // Interactive mode: Direct Claude Code session
    command = `cat "${promptFile}" | claude --dangerously-skip-permissions --model sonnet`;
    console.log('[claudo] Starting interactive Manager session...');
    console.log('[claudo] You can now interact directly with the Manager agent.');
    console.log('[claudo] Use the Bash tool to spawn subagents: node dist/src/agent.js [type] "task"');
    console.log('');
    
    spawnOptions = {
      stdio: 'inherit',  // Direct terminal I/O for interactive mode
      env: {
        ...process.env,
        NODE_ENV: 'production'
      }
    };
  } else {
    // Normal mode: JSON streaming for parsing
    command = `cat "${promptFile}" | claude --dangerously-skip-permissions --output-format stream-json --input-format text --verbose --model sonnet`;
    console.error('[claudo] DEBUG: Executing command via bash -c');
    console.error('[claudo] DEBUG: Command:', command);
    
    spawnOptions = {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CLAUDE_OUTPUT_FORMAT: 'stream-json',
        NODE_ENV: 'production'
      }
    };
  }
  
  // Spawn the command in container context
  const manager = spawn('bash', ['-c', command], spawnOptions);
  
  if (!isInteractive) {
    // Set up output logging to capture clean JSON stream (non-interactive only)
    const outputLogPath = path.join(claudoDir, 'manager-output.jsonl');
    const outputStream = createWriteStream(outputLogPath, { flags: 'a' });
    console.error('[claudo] DEBUG: Raw JSON will be logged to', outputLogPath);
    
    // Output raw JSON directly to stdout and save to output file
    // No parsing - let the host-based parser handle it
    manager.stdout.pipe(process.stdout);
    manager.stdout.pipe(outputStream);
    
    manager.stderr.on('data', (data) => {
      console.error('[claudo] Manager stderr:', data.toString());
    });
    
    manager.on('close', (code) => {
      console.error(`[claudo] Manager process exited with code ${code}`);
      outputStream.end();
    });
  }
  
  // Handle process events
  manager.on('error', (error) => {
    console.error('[claudo] Manager error:', error);
  });
  
  // Handle container termination
  process.on('SIGINT', () => {
    console.error('[claudo] Stopping Manager...');
    manager.kill('SIGTERM');
    setTimeout(() => {
      manager.kill('SIGKILL');
      process.exit(0);
    }, 5000);
  });
  
  process.on('SIGTERM', () => {
    console.error('[claudo] Terminating Manager...');
    manager.kill('SIGTERM');
  });
}

// Check if run directly or imported
if (require.main === module) {
  const isInteractive = process.env.CLAUDO_INTERACTIVE === 'true';
  if (isInteractive) {
    console.log('[claudo] Starting Manager in interactive mode...');
  } else {
    console.error('[claudo] Starting Manager with streaming JSON bus...');
  }
  runManager();
}