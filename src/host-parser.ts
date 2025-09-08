#!/usr/bin/env node

import { spawn, ChildProcess } from 'child_process';
import { ClaudeStreamParser } from './parser';
import * as path from 'path';

/**
 * Host-based parser that reads clean JSON from docker logs (stderr filtered)
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
      console.log(`[claudo] Following clean JSON from docker logs (stderr filtered)...`);
      
      // Use docker logs with stderr filtered to get clean JSON stream
      this.tailProcess = spawn('bash', ['-c', 'docker logs -f claudo-manager 2>/dev/null'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Pipe tail output through our parser
      if (this.tailProcess.stdout) {
        this.tailProcess.stdout.pipe(this.parser);
      }

      // Handle errors
      this.tailProcess.on('error', (error) => {
        console.error('[claudo] Docker logs process error:', error.message);
        reject(error);
      });

      // Handle stderr from docker logs command
      if (this.tailProcess.stderr) {
        this.tailProcess.stderr.on('data', (data) => {
          const errorText = data.toString().trim();
          if (errorText.includes('No such container')) {
            console.error('[claudo] Container not found. Use "claudo up" to start the manager first.');
            this.stop();
            reject(new Error('Container not found'));
          } else if (errorText) {
            console.error('[claudo] Docker logs stderr:', errorText);
          }
        });
      }

      // Handle process exit
      this.tailProcess.on('close', (code) => {
        console.log(`[claudo] Docker logs process exited with code ${code}`);
        resolve();
      });

      // Setup graceful shutdown
      this.setupShutdownHandlers();
    });
  }

  /**
   * Stop following docker logs
   */
  stop(): void {
    if (this.tailProcess) {
      console.log('\n[claudo] Stopping docker logs parser...');
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