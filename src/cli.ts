#!/usr/bin/env node

import { spawn } from 'child_process';
import { join } from 'path';
import { DockerManager } from './docker-manager';
import { ensureDockerAvailable } from './utils/docker-utils';
import { ExecutionContext } from './execution-context';

interface ParsedArgs {
  command: string;
  promptFile?: string;
  executionMode?: ExecutionContext;
  debugMode?: boolean;
  interactiveMode?: boolean;
  printMode?: boolean;
  remainingArgs: string[];
}

function parseArgs(): ParsedArgs {
  const command = process.argv[2];
  const args = process.argv.slice(3);
  
  const result: ParsedArgs = {
    command,
    remainingArgs: []
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--prompt-file=')) {
      result.promptFile = arg.split('=')[1];
    } else if (arg === '--prompt-file' && i + 1 < args.length) {
      result.promptFile = args[++i];
    } else if (arg === '--docker') {
      result.executionMode = ExecutionContext.DOCKER;
    } else if (arg === '--native' || arg === '--host') {
      result.executionMode = ExecutionContext.NATIVE;
    } else if (arg === '-d' || arg === '--debug') {
      result.debugMode = true;
    } else if (arg === '-it' || arg === '--interactive') {
      result.interactiveMode = true;
    } else if (arg === '-p' || arg === '--print') {
      result.printMode = true;
    } else {
      result.remainingArgs.push(arg);
    }
  }
  
  return result;
}

const { command, promptFile, executionMode, debugMode, interactiveMode, printMode, remainingArgs: args } = parseArgs();

const scriptPath = (script: string) => join(__dirname, script);

switch (command) {
  case 'up':
    if (debugMode) {
      console.log('[claudo] Starting Manager in debug mode...');
      process.env.CLAUDO_DEBUG = 'true';
    } else if (interactiveMode) {
      console.log('[claudo] Starting Manager in interactive mode...');
      process.env.CLAUDO_INTERACTIVE = 'true';
    } else if (printMode) {
      console.log('[claudo] Starting Manager in print mode (single response)...');
      process.env.CLAUDO_PRINT = 'true';
    } else {
      console.log('[claudo] Starting Manager...');
    }
    require(scriptPath('up'));
    break;

  case 'down':
    console.log('[claudo] Stopping Manager...');
    require(scriptPath('down'));
    break;

  case 'build':
    if (!ensureDockerAvailable()) {
      process.exit(1);
    }
    const dockerManager = new DockerManager();
    dockerManager.buildImage(true).then(success => {
      process.exit(success ? 0 : 1);
    });
    break;

  case 'rebuild':
    if (!ensureDockerAvailable()) {
      process.exit(1);
    }
    const dockerMgr = new DockerManager();
    console.log('[claudo] Force rebuilding Docker image...');
    dockerMgr.buildImage(true).then(success => {
      process.exit(success ? 0 : 1);
    });
    break;

  case 'logs':
    require(scriptPath('logs'));
    break;

  case 'status':
    const { showStatus } = require(scriptPath('status'));
    showStatus().catch(console.error);
    break;

  case 'manager':
    // Manager runs similar to other agents but with its own entry point
    const managerArgs = [scriptPath('manager.js')];
    
    // Add mode flags
    if (debugMode) {
      managerArgs.push('--debug');
    }
    if (interactiveMode) {
      managerArgs.push('--interactive');
    }
    if (printMode) {
      managerArgs.push('--print');
    }
    
    // Add execution context if specified
    if (executionMode) {
      managerArgs.push('--execution-mode', executionMode);
    }
    
    // Add prompt file if specified
    if (promptFile) {
      managerArgs.push('--prompt-file', promptFile);
    }
    
    // Add remaining user arguments (including direct prompt after -p)
    managerArgs.push(...args);

    const managerProcess = spawn('node', managerArgs, {
      stdio: 'inherit',
      shell: false
    });

    managerProcess.on('error', (error) => {
      console.error('[claudo] Error starting manager:', error.message);
      process.exit(1);
    });

    managerProcess.on('exit', (code) => {
      process.exit(code || 0);
    });
    break;

  case 'plan':
  case 'worker':
  case 'critic':
  case 'oracle':
    // Build arguments for agent
    const agentArgs = [scriptPath('agent.js'), command];
    
    // Add execution context if specified
    if (executionMode) {
      agentArgs.push('--execution-mode', executionMode);
    }
    
    // Add prompt file if specified
    if (promptFile) {
      agentArgs.push('--prompt-file', promptFile);
    }
    
    // Add remaining user arguments
    agentArgs.push(...args);

    const agentProcess = spawn('node', agentArgs, {
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
  up           Start the Manager container (auto-builds if needed)
  up -d        Start Manager in debug mode (single response with full output)
  up -it       Start Manager in interactive mode (full Claude session)
  down         Stop the Manager container
  build        Build the Docker image if missing
  rebuild      Force rebuild the Docker image
  status       Show system status and recent activity
  logs         View Manager logs (use -f to follow)
  plan         Run the planning agent
  worker       Run the worker agent
  critic       Run the critic agent
  oracle       Run the oracle agent

Options:
  --version              Show version number
  --help                 Show this help message
  --prompt-file <path>   Use custom prompt file (agent commands only)
  --docker               Force Docker execution (agent commands only)
  --native, --host       Force native execution (agent commands only)

Examples:
  claudo up                                    # Start the manager (auto-builds if needed)
  claudo build                                 # Build Docker image
  claudo logs -f                               # Follow manager logs
  claudo plan "task"                           # Run planning agent with task
  claudo plan --prompt-file=./my-prompt.md    # Use custom prompt file
  claudo plan --docker "task"                 # Force Docker execution
  claudo down                                  # Stop the manager
`);
    break;

  default:
    console.error(`Unknown command: ${command}`);
    console.error('Use "claudo --help" for available commands');
    process.exit(1);
}