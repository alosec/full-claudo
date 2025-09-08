#!/usr/bin/env node

import { spawn } from 'child_process';
import { ClaudeStreamParser } from './parser';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Debug wrapper for the parser to trace stream flow and identify failure points
 */

const workDir = process.argv[2] || '/home/alex/code/full-claudo';
const outputFile = path.join(workDir, '.claudo', 'manager-output.jsonl');
const debugFile = path.join(workDir, '.claudo', 'parser-debug.log');

// Create debug log stream
const debugLog = fs.createWriteStream(debugFile, { flags: 'a' });

// Store original console functions before any overrides
const originalConsoleError = console.error;

function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  debugLog.write(logMessage);
  originalConsoleError(logMessage.trim());
}

log('=== Parser Debug Started ===');
log(`Monitoring file: ${outputFile}`);

// Check if file exists
if (!fs.existsSync(outputFile)) {
  log(`ERROR: File does not exist: ${outputFile}`);
  process.exit(1);
}

// Create parser with debug hooks
const parser = new ClaudeStreamParser({
  agentName: 'DebugManager',
  useColors: true
});

// Hook into parser events
let chunkCount = 0;
let lineCount = 0;
let errorCount = 0;
let lastChunkTime = Date.now();

parser.on('pipe', (src) => {
  log('Parser connected to source stream');
});

parser.on('unpipe', (src) => {
  log('Parser disconnected from source stream');
});

parser.on('error', (err) => {
  errorCount++;
  log(`PARSER ERROR #${errorCount}: ${err.message}`);
  log(`Stack trace: ${err.stack}`);
});

parser.on('finish', () => {
  log('Parser finished processing');
});

parser.on('end', () => {
  log('Parser stream ended');
});

// Start tail process with enhanced monitoring
log('Starting tail process...');
const tailProcess = spawn('tail', ['-f', outputFile], {
  stdio: ['ignore', 'pipe', 'pipe']
});

log(`Tail process started with PID: ${tailProcess.pid}`);

// Monitor tail stdout
tailProcess.stdout?.on('data', (chunk) => {
  chunkCount++;
  const chunkSize = chunk.length;
  const timeSinceLast = Date.now() - lastChunkTime;
  lastChunkTime = Date.now();
  
  log(`TAIL CHUNK #${chunkCount}: ${chunkSize} bytes (${timeSinceLast}ms since last)`);
  
  // Count lines in chunk
  const chunkStr = chunk.toString();
  const lines = chunkStr.split('\n').filter((l: string) => l.trim());
  lineCount += lines.length;
  
  log(`Lines in chunk: ${lines.length} (total: ${lineCount})`);
  
  // Show first 100 chars of each line
  lines.forEach((line: string, i: number) => {
    if (line.length > 0) {
      log(`  Line ${i + 1}: ${line.substring(0, 100)}${line.length > 100 ? '...' : ''}`);
    }
  });
});

// Monitor tail stderr
tailProcess.stderr?.on('data', (data) => {
  log(`TAIL STDERR: ${data.toString()}`);
});

// Monitor tail process events
tailProcess.on('error', (err) => {
  log(`TAIL PROCESS ERROR: ${err.message}`);
});

tailProcess.on('exit', (code, signal) => {
  log(`TAIL PROCESS EXITED: code=${code}, signal=${signal}`);
});

tailProcess.on('close', (code, signal) => {
  log(`TAIL PROCESS CLOSED: code=${code}, signal=${signal}`);
});

// Pipe tail to parser
log('Connecting tail to parser...');
tailProcess.stdout?.pipe(parser);

// Monitor parser output
let outputCount = 0;
const originalConsoleLog = console.log;

// Override console.log to track output
console.log = (...args) => {
  outputCount++;
  log(`CONSOLE.LOG #${outputCount}: ${args.join(' ').substring(0, 200)}`);
  originalConsoleLog.apply(console, args);
};

// Override console.error to track errors (but not our own log function's errors)
const trackedConsoleError = console.error;
console.error = (...args) => {
  log(`CONSOLE.ERROR: ${args.join(' ').substring(0, 200)}`);
  originalConsoleError.apply(console, args);
};

// Health check every 5 seconds
setInterval(() => {
  const uptime = Math.floor(process.uptime());
  log(`=== HEALTH CHECK at ${uptime}s ===`);
  log(`  Chunks received: ${chunkCount}`);
  log(`  Lines processed: ${lineCount}`);
  log(`  Console outputs: ${outputCount}`);
  log(`  Parser errors: ${errorCount}`);
  log(`  Tail process alive: ${!tailProcess.killed}`);
  log(`  Memory usage: ${JSON.stringify(process.memoryUsage())}`);
  
  // Check if we're stuck
  const timeSinceLast = Date.now() - lastChunkTime;
  if (timeSinceLast > 10000 && chunkCount > 0) {
    log(`  WARNING: No data for ${Math.floor(timeSinceLast / 1000)}s`);
  }
}, 5000);

// Graceful shutdown
process.on('SIGINT', () => {
  log('Received SIGINT, shutting down...');
  tailProcess.kill('SIGTERM');
  debugLog.end();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Received SIGTERM, shutting down...');
  tailProcess.kill('SIGTERM');
  debugLog.end();
  process.exit(0);
});

log('Debug monitor ready, waiting for data...');