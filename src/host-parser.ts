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
      
      // Use tail to read directly from manager output file
      this.tailProcess = spawn('bash', ['-c', `tail -f ${this.outputFile}`], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Pipe tail output through our parser
      if (this.tailProcess.stdout) {
        this.tailProcess.stdout.pipe(this.parser);
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
    if (this.tailProcess) {
      console.log('\n[claudo] Stopping file tail parser...');
      this.tailProcess.kill('SIGTERM');
      this.tailProcess = null;
    }
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