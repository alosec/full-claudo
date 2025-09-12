#!/usr/bin/env node

import { spawn } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, createWriteStream } from 'fs';
import * as path from 'path';
import { detectContext, resolveWorkingDirectory, resolvePromptPath, ExecutionContext } from './execution-context';

// Run Manager Claude within container - supports JSON streaming, debug, and interactive modes
async function runManager() {
  const isInteractive = process.env.CLAUDO_INTERACTIVE === 'true';
  const isDebug = process.env.CLAUDO_DEBUG === 'true';
  const isTesting = process.env.TESTING_MODE === 'true' || process.argv.includes('--testing');
  
  // Detect execution context and resolve paths accordingly
  const context = detectContext();
  const workDir = resolveWorkingDirectory(context);
  const claudoDir = path.join(workDir, '.claudo');
  const managerSystemPrompt = resolvePromptPath('manager.md', context);
  
  // Ensure .claudo directory exists
  try {
    mkdirSync(claudoDir, { recursive: true });
  } catch (e) {}
  
  // Prepare the prompt
  let fullPrompt: string;
  
  if (isTesting && process.argv.includes('--prompt-stdin')) {
    console.log('[claudo] Starting Manager in testing mode with stdin prompt...');
    
    // Read test prompt from stdin
    fullPrompt = '';
    for await (const chunk of process.stdin) {
      fullPrompt += chunk;
    }
    console.error('[claudo] DEBUG: Read test prompt from stdin, length:', fullPrompt.length);
  } else {
    // Normal mode - read manager.md
    const systemPrompt = readFileSync(managerSystemPrompt, 'utf-8');
    const taskPrompt = 'Act as Manager Claude and coordinate the work.';
    fullPrompt = `${taskPrompt}\n\n---\n\n${systemPrompt}`;
  }
  
  // Save prompt for debugging
  const promptFile = path.join(claudoDir, 'manager-prompt.txt');
  writeFileSync(promptFile, fullPrompt);
  console.error('[claudo] DEBUG: Prompt file saved to:', promptFile);
  console.error('[claudo] DEBUG: Prompt length:', fullPrompt.length);
  
  // Build the command based on mode
  let command: string;
  let spawnOptions: any;
  
  if (isDebug) {
    // Debug mode: Use --print flag for single response with full visibility
    command = `claude --dangerously-skip-permissions --model sonnet --print --prompt "$(cat '${promptFile}')"`;
    console.log('[claudo] Starting Manager in debug mode...');
    console.log('[claudo] Manager will process the full prompt and show its reasoning.');
    console.log('[claudo] Note: This is a single-response mode for debugging.');
    console.log('');
    
    spawnOptions = {
      stdio: 'inherit',  // Direct terminal I/O for debug mode
      env: {
        ...process.env,
        NODE_ENV: 'production'
      }
    };
  } else if (isInteractive) {
    // Interactive mode: Start Claude without initial prompt in a PTY
    // User will need to paste the context manually or we'll show it as reference
    console.log('[claudo] Starting Manager in interactive mode...');
    console.log('[claudo] Note: Due to TTY limitations in Docker, starting without initial context.');
    console.log('[claudo] Manager context has been saved to:', promptFile);
    console.log('[claudo] You can reference it in your conversation.\n');
    
    // Use script to provide PTY, start Claude without initial prompt
    // Export HOME to ensure Claude finds credentials
    command = `script -e -q -c "HOME=/home/node claude --dangerously-skip-permissions --model sonnet" /dev/null`;
    
    spawnOptions = {
      stdio: 'inherit',  // Direct terminal I/O for interactive mode
      env: {
        ...process.env,
        NODE_ENV: 'production',
        TERM: 'xterm-256color',  // Ensure proper terminal type
        HOME: '/home/node'  // Ensure Claude finds credentials in the right location
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
  
  if (!isInteractive && !isDebug) {
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
  const isDebug = process.env.CLAUDO_DEBUG === 'true';
  
  if (isInteractive) {
    console.log('[claudo] Starting Manager in interactive mode...');
  } else if (isDebug) {
    console.log('[claudo] Starting Manager in debug mode...');
  } else {
    console.error('[claudo] Starting Manager with streaming JSON bus...');
  }
  runManager().catch(err => {
    console.error('[claudo] Manager error:', err);
    process.exit(1);
  });
}