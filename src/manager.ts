#!/usr/bin/env node

import { spawn } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import * as path from 'path';
import { detectContext, resolveWorkingDirectory, resolvePromptPath } from './execution-context';

interface ManagerArgs {
  printMode?: boolean;
  interactiveMode?: boolean;
  debugMode?: boolean;
  testMode?: boolean;
  promptFile?: string;
  directPrompt?: string;
  executionMode?: string;
}

function parseManagerArgs(): ManagerArgs {
  const args = process.argv.slice(2);
  const result: ManagerArgs = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--print' || arg === '-p') {
      result.printMode = true;
      // Check if next arg is the direct prompt (not a flag)
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        result.directPrompt = args[++i];
      }
    } else if (arg === '--interactive' || arg === '-it') {
      result.interactiveMode = true;
    } else if (arg === '--debug' || arg === '-d') {
      result.debugMode = true;
    } else if (arg === '--test') {
      result.testMode = true;
    } else if (arg === '--prompt-file' && i + 1 < args.length) {
      result.promptFile = args[++i];
    } else if (arg.startsWith('--prompt-file=')) {
      result.promptFile = arg.split('=')[1];
    } else if (arg === '--execution-mode' && i + 1 < args.length) {
      result.executionMode = args[++i];
    } else if (!arg.startsWith('-') && result.printMode && !result.directPrompt) {
      // Capture direct prompt after -p flag
      result.directPrompt = arg;
    }
  }
  
  return result;
}

async function runManager() {
  const args = parseManagerArgs();
  
  // Detect execution context and resolve paths
  const context = detectContext();
  const workDir = resolveWorkingDirectory(context);
  const claudoDir = path.join(workDir, '.claudo');
  
  // Ensure .claudo directory exists
  try {
    mkdirSync(claudoDir, { recursive: true });
  } catch (e) {}
  
  // Prepare the prompt
  let fullPrompt: string;
  
  if (args.directPrompt) {
    // Direct prompt provided via -p "prompt"
    fullPrompt = args.directPrompt;
    console.log('[claudo] Manager running with direct prompt');
  } else if (args.promptFile) {
    // Prompt file provided
    fullPrompt = readFileSync(args.promptFile, 'utf-8');
    console.log('[claudo] Manager running with prompt from file:', args.promptFile);
  } else if (args.testMode) {
    // Test mode - use simplified prompt
    fullPrompt = `# Test Mode Manager

You are Manager Claude in test mode. Respond with a simple confirmation:
"MANAGER TEST: Ready for coordination"`;
    console.log('[claudo] Manager running in test mode');
  } else {
    // Default mode - read manager.md
    const managerSystemPrompt = resolvePromptPath('manager.md', context);
    const systemPrompt = readFileSync(managerSystemPrompt, 'utf-8');
    const taskPrompt = 'Act as Manager Claude and coordinate the work.';
    fullPrompt = `${taskPrompt}\n\n---\n\n${systemPrompt}`;
  }
  
  // Save prompt for debugging
  const promptFile = path.join(claudoDir, 'manager-prompt.txt');
  writeFileSync(promptFile, fullPrompt);
  
  // Build the command based on mode
  let command: string;
  let spawnOptions: any;
  
  if (args.interactiveMode) {
    // Interactive mode: Start Claude in interactive session
    console.log('[claudo] Starting Manager in interactive mode...');
    console.log('[claudo] Manager context saved to:', promptFile);
    console.log('[claudo] Starting interactive session...\n');
    
    // Use script to provide PTY for interactive mode
    command = `script -e -q -c "HOME=$HOME claude --dangerously-skip-permissions --model sonnet" /dev/null`;
    
    spawnOptions = {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        TERM: 'xterm-256color'
      }
    };
  } else if (args.printMode || args.directPrompt) {
    // Print mode: Use --print flag for single clean response
    command = `cat "${promptFile}" | claude --dangerously-skip-permissions --model sonnet --print`;
    
    if (!args.directPrompt && !args.promptFile && !args.testMode) {
      console.log('[claudo] Manager running in print mode with full context...');
      console.log('[claudo] This may take 60+ seconds for initial response.\n');
    }
    
    spawnOptions = {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'production'
      }
    };
  } else if (args.debugMode) {
    // Debug mode: Use --print flag with visible reasoning
    command = `cat "${promptFile}" | claude --dangerously-skip-permissions --model sonnet --print`;
    console.log('[claudo] Manager running in debug mode...');
    console.log('[claudo] Manager will show its reasoning.\n');
    
    spawnOptions = {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'production'
      }
    };
  } else {
    // Normal mode: JSON streaming for session tracking
    command = `cat "${promptFile}" | claude --dangerously-skip-permissions --output-format stream-json --input-format text --verbose --model sonnet`;
    console.log('[claudo] Manager running with JSON streaming...');
    
    spawnOptions = {
      stdio: 'inherit',
      env: {
        ...process.env,
        CLAUDE_OUTPUT_FORMAT: 'stream-json',
        NODE_ENV: 'production'
      }
    };
  }
  
  // Spawn the command
  const manager = spawn('bash', ['-c', command], spawnOptions);
  
  // Handle process events
  manager.on('error', (error) => {
    console.error('[claudo] Manager error:', error);
    process.exit(1);
  });
  
  manager.on('exit', (code) => {
    if (code !== 0 && code !== 130) { // 130 is Ctrl+C
      console.error(`[claudo] Manager exited with code ${code}`);
    }
    process.exit(code || 0);
  });
  
  // Handle termination
  process.on('SIGINT', () => {
    manager.kill('SIGTERM');
    setTimeout(() => {
      manager.kill('SIGKILL');
      process.exit(0);
    }, 5000);
  });
  
  process.on('SIGTERM', () => {
    manager.kill('SIGTERM');
  });
}

// Run if executed directly
if (require.main === module) {
  runManager().catch(err => {
    console.error('[claudo] Manager error:', err);
    process.exit(1);
  });
}