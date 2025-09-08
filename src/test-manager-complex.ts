#!/usr/bin/env node

import { spawn } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, createWriteStream, existsSync } from 'fs';
import * as path from 'path';
import { ClaudeStreamParser } from './parser';

/**
 * Complex test to reproduce real-world hanging scenario
 * This mimics the actual manager behavior that causes parser to hang
 */

interface ComplexTestOptions {
  model?: string;
  debug?: boolean;
  noParser?: boolean;
  timeout?: number;
  useImprovedParser?: boolean;
}

function runComplexTest(options: ComplexTestOptions = {}) {
  const {
    model = 'sonnet',
    debug = true,  // Default to debug mode to capture issues
    noParser = false,
    timeout = 20000,
    useImprovedParser = false
  } = options;

  console.log('[complex-test] Starting Complex Manager Test...');
  console.log('[complex-test] This test reproduces the real hanging scenario');
  console.log('[complex-test] Model:', model);
  console.log('[complex-test] Debug mode:', debug);
  console.log('[complex-test] Parser:', useImprovedParser ? 'improved' : 'original');
  console.log('[complex-test] Timeout:', timeout, 'ms');
  console.log('');

  // Ensure .claudo directory exists
  const claudoDir = path.join(process.cwd(), '.claudo');
  mkdirSync(claudoDir, { recursive: true });

  // Create a complex prompt that mimics the real manager behavior
  const complexPrompt = `You are a Manager agent testing the parser system with complex operations.

Your task: Perform multiple file operations similar to the real manager

Instructions:
1. Use Read tool to try reading a directory (this will fail - expected)
2. Use Bash tool to list memory-bank directory
3. Use Read tool to read projectbrief.md
4. Use Read tool to read activeContext.md  
5. Use Read tool to read progress.md
6. Use Bash tool to list planning directory
7. Use Read tool to read planning/INDEX.md
8. Process and summarize what you found
9. Use Read tool to check multiple more files if they exist

This simulates the real manager flow that causes hanging.`;

  // Write prompt to temporary file
  const tempPromptFile = path.join(claudoDir, 'complex-test-prompt.txt');
  writeFileSync(tempPromptFile, complexPrompt);

  // Set up debug logging
  const debugLogPath = path.join(claudoDir, 'complex-test-debug.jsonl');
  const debugStream = createWriteStream(debugLogPath, { flags: 'w' });
  
  console.log('[complex-test] Debug output will be saved to:', debugLogPath);

  // Build the command
  const command = `cat "${tempPromptFile}" | claude --dangerously-skip-permissions --output-format stream-json --input-format text --verbose --model ${model}`;

  console.log('[complex-test] Executing command...');
  if (debug) {
    console.log('[complex-test] Command:', command);
  }
  console.log('');

  // Spawn the process
  const manager = spawn('bash', ['-c', command], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: process.cwd()
  });

  // Set up timeout
  const timeoutHandle = setTimeout(() => {
    console.log('\n[complex-test] ⚠️  TIMEOUT REACHED - This indicates hanging!');
    console.log('[complex-test] Killing process...');
    
    // Print statistics before killing
    if (parser) {
      try {
        const stats = (parser as any).getStatistics?.();
        if (stats) {
          console.log('[complex-test] Parser statistics at timeout:', stats);
        }
      } catch (e) {
        console.log('[complex-test] Could not get parser statistics');
      }
    }
    
    manager.kill('SIGTERM');
  }, timeout);

  // Track detailed statistics
  let lineCount = 0;
  let errorCount = 0;
  let toolUseCount = 0;
  let toolResultCount = 0;
  let lastLineTime = Date.now();
  let hangDetected = false;
  const lineTimestamps: number[] = [];

  // Monitor for hanging (no output for 5 seconds)
  const hangMonitor = setInterval(() => {
    const timeSinceLastLine = Date.now() - lastLineTime;
    if (timeSinceLastLine > 5000 && lineCount > 0 && !hangDetected) {
      hangDetected = true;
      console.log(`\n[complex-test] ⚠️  HANG DETECTED: No output for ${(timeSinceLastLine/1000).toFixed(1)}s`);
      console.log(`[complex-test] Last activity was ${lineCount} lines ago`);
      console.log(`[complex-test] Tool uses: ${toolUseCount}, Tool results: ${toolResultCount}`);
    }
  }, 1000);

  // Set up parser
  let parser: ClaudeStreamParser | null = null;
  if (!noParser) {
    if (useImprovedParser) {
      // Import and use improved parser if requested
      const { ImprovedClaudeStreamParser } = require('./parser-improved');
      parser = new ImprovedClaudeStreamParser({
        agentName: 'ComplexTest',
        verboseErrors: true,
        fallbackToRaw: true
      });
    } else {
      parser = new ClaudeStreamParser('ComplexTest', true);
    }
    
    // Track parser errors
    parser?.on('error', (error) => {
      errorCount++;
      console.error('[complex-test] Parser error:', error);
    });

    // Monitor parser events if available
    (parser as any).on('parser-error', (data: any) => {
      console.error('[complex-test] Parser internal error:', data);
    });
  }

  // Process stdout
  manager.stdout.on('data', (chunk) => {
    const data = chunk.toString();
    lastLineTime = Date.now();
    
    // Count lines and track timing
    const lines = data.split('\n').filter((l: string) => l.trim());
    lineCount += lines.length;
    lineTimestamps.push(Date.now());
    
    // Detailed analysis of each line
    lines.forEach((line: string, index: number) => {
      // Track tool patterns
      if (line.includes('"type":"tool_use"')) {
        toolUseCount++;
        console.log(`[complex-test] 🔧 Tool use #${toolUseCount} detected at line ${lineCount - lines.length + index + 1}`);
      }
      if (line.includes('"type":"tool_result"')) {
        toolResultCount++;
        console.log(`[complex-test] 📊 Tool result #${toolResultCount} detected at line ${lineCount - lines.length + index + 1}`);
        
        // Check if this is around where hanging occurs
        if (toolResultCount >= 3 && toolResultCount <= 5) {
          console.log(`[complex-test] ⚠️  Critical zone: Tool result ${toolResultCount} - monitoring for hang...`);
        }
      }
      
      // Look for Read tool results which seem to trigger hanging
      if (line.includes('"tool_use_id"') && line.includes('Read')) {
        console.log(`[complex-test] 📖 Read tool result detected - potential hang trigger`);
      }
    });
    
    // Write to debug log
    debugStream.write(chunk);
    debugStream.write(`\n--- Line count: ${lineCount}, Time: ${new Date().toISOString()} ---\n`);
    
    // Send to parser if enabled
    if (parser) {
      try {
        parser.write(chunk);
      } catch (e) {
        errorCount++;
        console.error('[complex-test] Error writing to parser:', e);
        console.error('[complex-test] Chunk that caused error (first 200 chars):', data.substring(0, 200));
      }
    } else if (debug) {
      // If no parser, show raw output in debug mode
      process.stdout.write(chunk);
    }
  });

  // Process stderr
  manager.stderr.on('data', (chunk) => {
    console.error('[complex-test] STDERR:', chunk.toString());
  });

  // Handle process exit
  manager.on('close', (code) => {
    clearTimeout(timeoutHandle);
    clearInterval(hangMonitor);
    debugStream.end();
    
    console.log('\n' + '='.repeat(70));
    console.log('[complex-test] Test completed');
    console.log('[complex-test] Exit code:', code);
    console.log('[complex-test] Statistics:');
    console.log('  - Lines processed:', lineCount);
    console.log('  - Tool uses:', toolUseCount);
    console.log('  - Tool results:', toolResultCount);
    console.log('  - Parser errors:', errorCount);
    console.log('  - Hang detected:', hangDetected);
    
    // Analyze line timing
    if (lineTimestamps.length > 1) {
      const gaps: number[] = [];
      for (let i = 1; i < lineTimestamps.length; i++) {
        gaps.push(lineTimestamps[i] - lineTimestamps[i-1]);
      }
      const maxGap = Math.max(...gaps);
      const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      console.log('  - Max time between lines:', (maxGap/1000).toFixed(2), 's');
      console.log('  - Avg time between lines:', (avgGap/1000).toFixed(3), 's');
    }
    
    if (debug && existsSync(debugLogPath)) {
      const debugSize = require('fs').statSync(debugLogPath).size;
      console.log('  - Debug log size:', (debugSize / 1024).toFixed(2), 'KB');
      
      // Read last few lines of debug log to see where it stopped
      try {
        const debugContent = readFileSync(debugLogPath, 'utf8');
        const debugLines = debugContent.split('\n');
        const lastFewLines = debugLines.slice(-10).filter(l => l.trim() && !l.startsWith('---'));
        console.log('\n[complex-test] Last few debug lines before stop:');
        lastFewLines.forEach((line, i) => {
          console.log(`  [${i-lastFewLines.length}] ${line.substring(0, 100)}${line.length > 100 ? '...' : ''}`);
        });
      } catch (e) {
        console.log('[complex-test] Could not read debug log');
      }
    }
    
    if (hangDetected) {
      console.log('\n⚠️  HANG WAS DETECTED - Parser likely failed silently');
      console.log('Check', debugLogPath, 'for full output to diagnose the issue');
    } else if (errorCount > 0) {
      console.log('\n⚠️  Parser encountered errors. Check implementation.');
    } else if (!noParser) {
      console.log('\n✅ Test completed without hanging!');
    }
    
    process.exit(code || 0);
  });

  // Handle errors
  manager.on('error', (error) => {
    console.error('[complex-test] Process error:', error);
    clearTimeout(timeoutHandle);
    clearInterval(hangMonitor);
    process.exit(1);
  });

  // Handle termination
  process.on('SIGINT', () => {
    console.log('\n[complex-test] Interrupted, cleaning up...');
    clearTimeout(timeoutHandle);
    clearInterval(hangMonitor);
    manager.kill('SIGINT');
  });
}

// Parse command-line arguments
function parseArgs(): ComplexTestOptions {
  const args = process.argv.slice(2);
  const options: ComplexTestOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--model':
      case '-m':
        options.model = args[++i];
        break;
      case '--debug':
      case '-d':
        options.debug = true;
        break;
      case '--no-debug':
        options.debug = false;
        break;
      case '--no-parser':
        options.noParser = true;
        break;
      case '--improved':
      case '-i':
        options.useImprovedParser = true;
        break;
      case '--timeout':
        options.timeout = parseInt(args[++i]) || 20000;
        break;
      case '--help':
      case '-h':
        console.log(`
Usage: npm run test:complex [options]

Options:
  -m, --model <model>    Model to use: sonnet, opus, haiku (default: sonnet)
  -d, --debug            Enable debug logging (default: true)
  --no-debug             Disable debug logging
  --no-parser            Disable parser (show raw JSON output)
  -i, --improved         Use improved parser instead of original
  --timeout <ms>         Timeout in milliseconds (default: 20000)
  -h, --help             Show this help message

This test reproduces the complex real-world scenario where the parser hangs
after processing multiple Read tool results.

Examples:
  npm run test:complex
  npm run test:complex --improved  # Test with improved parser
  npm run test:complex --no-parser --debug
  npm run test:complex --model opus --timeout 30000
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
  runComplexTest(options);
}

export { runComplexTest };