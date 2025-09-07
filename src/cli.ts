#!/usr/bin/env node

import { spawn } from 'child_process';
import { join } from 'path';

const command = process.argv[2];
const args = process.argv.slice(3);

const scriptPath = (script: string) => join(__dirname, script);

switch (command) {
  case 'up':
    console.log('[claudo] Starting Manager...');
    require(scriptPath('up'));
    break;

  case 'down':
    console.log('[claudo] Stopping Manager...');
    require(scriptPath('down'));
    break;

  case 'logs':
    require(scriptPath('logs'));
    break;

  case 'plan':
  case 'worker':
  case 'critic':
  case 'oracle':
    const agentProcess = spawn('node', [scriptPath('agent.js'), command, ...args], {
      stdio: 'inherit',
      shell: false
    });

    agentProcess.on('error', (error) => {
      console.error(`[claudo] Error starting ${command} agent:`, error.message);
      process.exit(1);
    });

    agentProcess.on('close', (code) => {
      process.exit(code || 0);
    });
    break;

  case '--version':
  case '-v':
    const pkg = require('../package.json');
    console.log(`claudo v${pkg.version}`);
    break;

  case '--help':
  case '-h':
  case undefined:
    console.log(`
Full Claudo - Simple Multi-Agent Claude System
    
Usage: claudo <command> [options]

Commands:
  up           Start the Manager container
  down         Stop the Manager container
  logs         View Manager logs (use -f to follow)
  plan         Run the planning agent
  worker       Run the worker agent
  critic       Run the critic agent
  oracle       Run the oracle agent

Options:
  --version    Show version number
  --help       Show this help message

Examples:
  claudo up              # Start the manager
  claudo logs -f         # Follow manager logs
  claudo plan "task"     # Run planning agent with task
  claudo down            # Stop the manager
`);
    break;

  default:
    console.error(`Unknown command: ${command}`);
    console.error('Use "claudo --help" for available commands');
    process.exit(1);
}