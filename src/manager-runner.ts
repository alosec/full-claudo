#!/usr/bin/env node

import { spawn } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import * as path from 'path';
import { ClaudeStreamParser } from './parser';

// Run Manager Claude within container with streaming output
function runManager() {
  // Look for prompts in container location first, then local
  let managerPrompt: string;
  try {
    managerPrompt = readFileSync('/usr/local/lib/claudo/prompts/manager.md', 'utf8');
  } catch (e) {
    // Fallback to local prompts directory
    managerPrompt = readFileSync('./prompts/manager.md', 'utf8');
  }
  
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
  
  // Spawn Claude Manager process
  const manager = spawn('claude', [
    '-p', `$(cat ${tempPromptFile})`,
    '--dangerously-skip-permissions',
    '--output-format', 'stream-json',
    '--input-format', 'text',
    '--verbose',
    '--model', 'sonnet'
  ], {
    stdio: ['pipe', 'pipe', 'inherit'],
    shell: true,
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