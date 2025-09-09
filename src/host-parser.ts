#!/usr/bin/env node

import { spawn, ChildProcess } from 'child_process';
import { ClaudeStreamParser } from './parser';
import * as path from 'path';

/**
 * Host-based parser that reads clean JSON directly from manager output file
 * This runs on the host machine where console.log works reliably
 */

export class HostDockerParser {
  private tailProcess: ChildProcess | null = null;
  private parser: ClaudeStreamParser;
  private outputFile: string;
  private lastDataTime: number = Date.now();
  private bytesRead: number = 0;
  private healthMonitor?: NodeJS.Timeout;

  constructor(workDir: string = '/home/alex/code/full-claudo', agentName: string = 'Manager') {
    this.outputFile = path.join(workDir, '.claudo', 'manager-output.jsonl');
    this.parser = new ClaudeStreamParser({
      agentName,
      useColors: true, // Colors work on host
      outputFile: undefined // Use console output
    });
  }

  /**
   * Start following docker logs for clean JSON (stderr filtered out)
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`[claudo] Following manager output from file: ${this.outputFile}`);
      
      // Start health monitoring
      this.healthMonitor = setInterval(() => {
        const timeSinceData = Date.now() - this.lastDataTime;
        if (timeSinceData > 15000) { // 15 seconds without data
          console.error(`[claudo] Warning: No data from tail for ${Math.floor(timeSinceData / 1000)}s`);
          console.error(`[claudo] Bytes read so far: ${this.bytesRead}`);
          
          // Check if tail process is still alive
          if (this.tailProcess && !this.tailProcess.killed) {
            console.error(`[claudo] Tail process is still running (PID: ${this.tailProcess.pid})`);
          } else {
            console.error(`[claudo] Tail process appears to be dead`);
            this.restartTail();
          }
        }
      }, 5000);
      
      // Use tail to read directly from manager output file
      this.tailProcess = spawn('bash', ['-c', `tail -f ${this.outputFile}`], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
	let debugLoggingOn = false;
      // Pipe tail output through our parser with monitoring
      if (debugLoggingOn && this.tailProcess.stdout) {
        // Monitor data flow
        this.tailProcess.stdout.on('data', (chunk) => {
          this.lastDataTime = Date.now();
          this.bytesRead += chunk.length;
          console.error(`[claudo-debug] Received ${chunk.length} bytes from tail (total: ${this.bytesRead})`);
        });
        
        // Pipe to parser only (parser outputs directly via console.log)
        this.tailProcess.stdout
          .on('error', (err) => {
            console.error('[claudo] Tail stdout error:', err.message);
          })
          .pipe(this.parser);
      }

      // Handle errors
      this.tailProcess.on('error', (error) => {
        console.error('[claudo] Tail process error:', error.message);
        reject(error);
      });

      // Handle stderr from tail command
      if (this.tailProcess.stderr) {
        this.tailProcess.stderr.on('data', (data) => {
          const errorText = data.toString().trim();
          if (errorText.includes('No such file')) {
            console.error('[claudo] Manager output file not found. Ensure manager is running and writing to:', this.outputFile);
            this.stop();
            reject(new Error('Output file not found'));
          } else if (errorText) {
            console.error('[claudo] Tail stderr:', errorText);
          }
        });
      }

      // Handle process exit
      this.tailProcess.on('close', (code) => {
        console.log(`[claudo] Tail process exited with code ${code}`);
        resolve();
      });

      // Setup graceful shutdown
      this.setupShutdownHandlers();
    });
  }

  /**
   * Stop following file tail
   */
  stop(): void {
    if (this.healthMonitor) {
      clearInterval(this.healthMonitor);
      this.healthMonitor = undefined;
    }
    if (this.tailProcess) {
      console.log('\n[claudo] Stopping file tail parser...');
      this.tailProcess.kill('SIGTERM');
      this.tailProcess = null;
    }
  }
  
  /**
   * Restart the tail process if it dies
   */
  private restartTail(): void {
    console.error('[claudo] Attempting to restart tail process...');
    this.stop();
    setTimeout(() => {
      this.start().catch((error) => {
        console.error('[claudo] Failed to restart tail:', error.message);
      });
    }, 1000);
  }

  /**
   * Setup handlers for graceful shutdown
   */
  private setupShutdownHandlers(): void {
    const shutdown = () => {
      this.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }
}

// CLI usage: node host-parser.js [work-dir] [agent-name]
if (require.main === module) {
  const workDir = process.argv[2] || '/home/alex/code/full-claudo';
  const agentName = process.argv[3] || 'Manager';
  
  const parser = new HostDockerParser(workDir, agentName);
  
  parser.start().catch((error) => {
    console.error('[claudo] Parser failed:', error.message);
    process.exit(1);
  });
}
