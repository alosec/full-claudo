#!/usr/bin/env node

import { spawn, ChildProcess } from 'child_process';
import { ClaudeStreamParser } from './parser';

/**
 * Host-based parser that reads docker logs and parses Claude's JSON stream
 * This runs on the host machine where console.log works reliably
 */

export class HostDockerParser {
  private dockerProcess: ChildProcess | null = null;
  private parser: ClaudeStreamParser;
  private containerName: string;

  constructor(containerName: string = 'claudo-manager', agentName: string = 'Manager') {
    this.containerName = containerName;
    this.parser = new ClaudeStreamParser({
      agentName,
      useColors: true, // Colors work on host
      outputFile: undefined // Use console output
    });
  }

  /**
   * Start following docker logs and parsing output
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`[claudo] Following logs from ${this.containerName}...`);
      
      this.dockerProcess = spawn('docker', ['logs', '-f', this.containerName], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Pipe docker logs through our parser
      if (this.dockerProcess.stdout) {
        this.dockerProcess.stdout.pipe(this.parser);
      }

      // Handle errors
      this.dockerProcess.on('error', (error) => {
        console.error('[claudo] Docker logs error:', error.message);
        reject(error);
      });

      // Handle stderr from docker logs
      if (this.dockerProcess.stderr) {
        this.dockerProcess.stderr.on('data', (data) => {
          const errorText = data.toString().trim();
          if (errorText.includes('No such container')) {
            console.error('[claudo] Container not found. Use "claudo up" to start the manager first.');
            this.stop();
            reject(new Error('Container not found'));
          } else if (errorText) {
            console.error('[claudo] Docker stderr:', errorText);
          }
        });
      }

      // Handle process exit
      this.dockerProcess.on('close', (code) => {
        console.log(`[claudo] Docker logs process exited with code ${code}`);
        resolve();
      });

      // Setup graceful shutdown
      this.setupShutdownHandlers();
    });
  }

  /**
   * Stop following logs
   */
  stop(): void {
    if (this.dockerProcess) {
      console.log('\n[claudo] Stopping log parser...');
      this.dockerProcess.kill('SIGTERM');
      this.dockerProcess = null;
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

// CLI usage: node host-parser.js [container-name] [agent-name]
if (require.main === module) {
  const containerName = process.argv[2] || 'claudo-manager';
  const agentName = process.argv[3] || 'Manager';
  
  const parser = new HostDockerParser(containerName, agentName);
  
  parser.start().catch((error) => {
    console.error('[claudo] Parser failed:', error.message);
    process.exit(1);
  });
}