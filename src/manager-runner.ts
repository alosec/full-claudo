#!/usr/bin/env node

import { spawn } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, createWriteStream } from 'fs';
import * as path from 'path';
import { ClaudeStreamParser, ParserOptions } from './parser';

// Run Manager Claude within container with streaming output
function runManager() {
  const workDir = '/workspace';
  const claudoDir = path.join(workDir, '.claudo');
  const managerSystemPrompt = path.join(workDir, 'prompts', 'manager.md');
  
  // Check if we're in file output mode (passed as CLI argument)
  const useFileOutput = process.argv.includes('--output-file');
  const outputFile = useFileOutput ? path.join(claudoDir, 'manager-output.log') : undefined;
  
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
  
  // Set up stream parsing with appropriate output mode
  const parserOptions: ParserOptions = {
    agentName: 'Manager',
    useColors: !useFileOutput,  // Disable colors when writing to file
    outputFile: outputFile
  };
  
  const parser = new ClaudeStreamParser(parserOptions);
  
  if (useFileOutput && outputFile) {
    console.log(`[claudo] Parser output will be written to: ${outputFile}`);
    // Clear the output file at start
    writeFileSync(outputFile, '');
  }
  
  // Set up debug logging to capture raw JSON
  const debugLogPath = path.join(claudoDir, 'manager-debug.jsonl');
  const debugStream = createWriteStream(debugLogPath, { flags: 'a' });
  console.log('[claudo] DEBUG: Raw JSON will be logged to', debugLogPath);
  
  // Pipe stdout through parser and also to debug file
  manager.stdout.pipe(parser);
  manager.stdout.pipe(debugStream);
  
  // Add error handling for parser
  parser.on('error', (error) => {
    console.error('[claudo] Parser error:', error);
    console.error('[claudo] Check', debugLogPath, 'for raw output');
  });
  
  parser.on('parser-error', (details) => {
    if (details.context === '_transform') {
      console.error('[claudo] Transform error, continuing...', details.error.message);
    }
  });
  
  // Handle process events
  manager.on('error', (error) => {
    console.error('[claudo] Manager error:', error);
  });
  
  manager.stderr.on('data', (data) => {
    console.error('[claudo] Manager stderr:', data.toString());
  });
  
  manager.on('close', (code) => {
    console.log(`[claudo] Manager process exited with code ${code}`);
    debugStream.end();
    parser.destroy();
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