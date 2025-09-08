#!/usr/bin/env node

import { spawn } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, createWriteStream, existsSync } from 'fs';
import * as path from 'path';
import { ClaudeStreamParser } from './parser';

/**
 * Standalone test script for running Manager in one-shot mode
 * This helps test the parser and manager flow without Docker complexity
 */

interface TestOptions {
  task?: string;
  model?: string;
  debug?: boolean;
  noParser?: boolean;
  timeout?: number;
}

function runOneShot(options: TestOptions = {}) {
  const {
    task = 'Read memory bank and report status',
    model = 'sonnet',
    debug = false,
    noParser = false,
    timeout = 30000
  } = options;

  console.log('[test-manager] Starting one-shot Manager test...');
  console.log('[test-manager] Task:', task);
  console.log('[test-manager] Model:', model);
  console.log('[test-manager] Debug mode:', debug);
  console.log('[test-manager] Parser enabled:', !noParser);
  console.log('[test-manager] Timeout:', timeout, 'ms');
  console.log('');

  // Ensure .claudo directory exists
  const claudoDir = path.join(process.cwd(), '.claudo');
  mkdirSync(claudoDir, { recursive: true });

  // Create a simple test prompt
  const testPrompt = `You are a Manager agent testing the parser system.

Your task: ${task}

Instructions:
1. Use the Bash tool to check git status
2. Use the Read tool to read package.json
3. Report what you found
4. This is a test - be brief and focus on testing tool usage

Important: This is a one-shot test. Complete the task and exit.`;

  // Write prompt to temporary file
  const tempPromptFile = path.join(claudoDir, 'test-prompt.txt');
  writeFileSync(tempPromptFile, testPrompt);

  // Set up debug logging
  const debugLogPath = path.join(claudoDir, 'test-debug.jsonl');
  const debugStream = createWriteStream(debugLogPath, { flags: 'w' }); // Overwrite for testing
  
  if (debug) {
    console.log('[test-manager] Debug output will be saved to:', debugLogPath);
  }

  // Build the command
  const command = `cat "${tempPromptFile}" | claude --dangerously-skip-permissions --output-format stream-json --input-format text --verbose --model ${model}`;

  console.log('[test-manager] Executing command...');
  if (debug) {
    console.log('[test-manager] Command:', command);
  }
  console.log('');

  // Spawn the process
  const manager = spawn('bash', ['-c', command], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: process.cwd()
  });

  // Set up timeout
  const timeoutHandle = setTimeout(() => {
    console.log('\\n[test-manager] Timeout reached, killing process...');
    manager.kill('SIGTERM');
  }, timeout);

  // Track statistics
  let lineCount = 0;
  let errorCount = 0;
  let toolUseCount = 0;
  let toolResultCount = 0;

  // Set up parser if not disabled
  let parser: ClaudeStreamParser | null = null;
  if (!noParser) {
    parser = new ClaudeStreamParser('TestManager', true);
    
    // Track parser errors
    parser.on('error', (error) => {
      errorCount++;
      console.error('[test-manager] Parser error:', error);
    });
  }

  // Process stdout
  manager.stdout.on('data', (chunk) => {
    const data = chunk.toString();
    
    // Count lines
    const lines = data.split('\\n').filter((l: string) => l.trim());
    lineCount += lines.length;
    
    // Count tool uses and results
    lines.forEach((line: string) => {
      if (line.includes('"type":"tool_use"')) toolUseCount++;
      if (line.includes('"type":"tool_result"')) toolResultCount++;
    });
    
    // Write to debug log if enabled
    if (debug) {
      debugStream.write(chunk);
    }
    
    // Send to parser if enabled
    if (parser) {
      try {
        parser.write(chunk);
      } catch (e) {
        errorCount++;
        console.error('[test-manager] Error writing to parser:', e);
      }
    } else if (debug) {
      // If no parser, show raw output in debug mode
      process.stdout.write(chunk);
    }
  });

  // Process stderr
  manager.stderr.on('data', (chunk) => {
    console.error('[test-manager] STDERR:', chunk.toString());
  });

  // Handle process exit
  manager.on('close', (code) => {
    clearTimeout(timeoutHandle);
    debugStream.end();
    
    console.log('\\n' + '=' .repeat(50));
    console.log('[test-manager] Test completed');
    console.log('[test-manager] Exit code:', code);
    console.log('[test-manager] Statistics:');
    console.log('  - Lines processed:', lineCount);
    console.log('  - Tool uses:', toolUseCount);
    console.log('  - Tool results:', toolResultCount);
    console.log('  - Parser errors:', errorCount);
    
    if (debug && existsSync(debugLogPath)) {
      const debugSize = require('fs').statSync(debugLogPath).size;
      console.log('  - Debug log size:', (debugSize / 1024).toFixed(2), 'KB');
    }
    
    if (errorCount > 0) {
      console.log('\\n⚠️  Parser encountered errors. Check implementation.');
    } else if (!noParser) {
      console.log('\\n✅ Parser processed stream without errors!');
    }
    
    process.exit(code || 0);
  });

  // Handle errors
  manager.on('error', (error) => {
    console.error('[test-manager] Process error:', error);
    clearTimeout(timeoutHandle);
    process.exit(1);
  });

  // Handle termination
  process.on('SIGINT', () => {
    console.log('\\n[test-manager] Interrupted, cleaning up...');
    clearTimeout(timeoutHandle);
    manager.kill('SIGINT');
  });
}

// Parse command-line arguments
function parseArgs(): TestOptions {
  const args = process.argv.slice(2);
  const options: TestOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--task':
      case '-t':
        options.task = args[++i];
        break;
      case '--model':
      case '-m':
        options.model = args[++i];
        break;
      case '--debug':
      case '-d':
        options.debug = true;
        break;
      case '--no-parser':
        options.noParser = true;
        break;
      case '--timeout':
        options.timeout = parseInt(args[++i]) || 30000;
        break;
      case '--help':
      case '-h':
        console.log(`
Usage: npm run test:manager [options]

Options:
  -t, --task <task>      Task for the manager to perform (default: "Read memory bank and report status")
  -m, --model <model>    Model to use: sonnet, opus, haiku (default: sonnet)
  -d, --debug            Enable debug logging to .claudo/test-debug.jsonl
  --no-parser            Disable parser (show raw JSON output)
  --timeout <ms>         Timeout in milliseconds (default: 30000)
  -h, --help             Show this help message

Examples:
  npm run test:manager
  npm run test:manager --task "Check git status" --debug
  npm run test:manager --no-parser --debug
  npm run test:manager --model opus --timeout 60000
`);
        process.exit(0);
      default:
        if (args[i].startsWith('-')) {
          console.error(`Unknown option: ${args[i]}`);
          process.exit(1);
        }
    }
  }
  
  return options;
}

// Run if called directly
if (require.main === module) {
  const options = parseArgs();
  runOneShot(options);
}

export { runOneShot };