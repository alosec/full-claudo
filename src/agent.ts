#!/usr/bin/env node

import { spawn } from 'child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import * as path from 'path';
import { PromptResolver } from './prompt-resolver';
import { ExecutionContext, getPreferredContext } from './execution-context';

interface AgentOptions {
  agentType: string;
  promptFile?: string;
  executionMode?: ExecutionContext;
  userPrompt: string;
}

function parseAgentArgs(): AgentOptions {
  const args = process.argv.slice(2);
  const agentType = args[0];
  
  if (!agentType || !['plan', 'worker', 'critic', 'oracle'].includes(agentType)) {
    console.error('Usage: claudo {plan|worker|critic|oracle} <prompt>');
    process.exit(1);
  }
  
  const result: AgentOptions = {
    agentType,
    userPrompt: ''
  };
  
  const promptArgs: string[] = [];
  
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--prompt-file' && i + 1 < args.length) {
      result.promptFile = args[++i];
    } else if (arg === '--execution-mode' && i + 1 < args.length) {
      result.executionMode = args[++i] as ExecutionContext;
    } else {
      promptArgs.push(arg);
    }
  }
  
  result.userPrompt = promptArgs.join(' ');
  return result;
}

// Spawn Claude agent as Node.js process
function spawnAgent() {
  const { agentType, promptFile, executionMode, userPrompt } = parseAgentArgs();
  
  // Determine execution context (prefer native for agents unless overridden)
  const preferredContext = executionMode || getPreferredContext('agent');
  const resolver = new PromptResolver(preferredContext);
  
  // Resolve prompt content
  const basePrompt = resolver.resolve({
    customPromptFile: promptFile,
    agentType
  });
  
  const fullPrompt = `${basePrompt}\n\nTask: ${userPrompt}`;
  
  // Ensure .claudo directory exists
  const claudoDir = path.join(process.cwd(), '.claudo');
  mkdirSync(claudoDir, { recursive: true });
  
  // Write prompt to temporary file
  const tempPromptFile = path.join(claudoDir, `${agentType}-prompt.txt`);
  writeFileSync(tempPromptFile, fullPrompt);
  
  // Read the prompt file content to pipe via stdin
  const promptContent = readFileSync(tempPromptFile, 'utf8');
  
  // Use stdin to avoid shell expansion issues with prompts containing '--' 
  const claudeArgs = [
    '--dangerously-skip-permissions',
    '--model', 'sonnet'
  ];

  // Spawn Claude process - no shell needed since we're not using shell expansion
  const claude = spawn('claude', claudeArgs, {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false
  });
  
  let sessionId = '';
  let responseBuffer = '';
  
  // Capture session ID from stderr (if verbose mode enabled)
  claude.stderr?.on('data', (data) => {
    const output = data.toString();
    
    // Try to extract session ID
    const sessionMatch = output.match(/Session ID: ([a-f0-9-]+)/);
    if (sessionMatch) {
      sessionId = sessionMatch[1];
      // Write session ID to temp file for monitoring
      const sessionFile = path.join(claudoDir, `${agentType}-session.txt`);
      writeFileSync(sessionFile, sessionId);
    }
  });
  
  // Buffer stdout for clean text response
  claude.stdout?.on('data', (data) => {
    responseBuffer += data.toString();
  });
  
  // Write prompt to stdin and close it
  claude.stdin?.write(promptContent);
  claude.stdin?.end();
  
  claude.on('close', (code) => {
    // Output clean response
    if (responseBuffer) {
      process.stdout.write(responseBuffer);
    }
    process.exit(code || 0);
  });
  
  claude.on('error', (error) => {
    console.error('[claudo] Error spawning Claude:', error.message);
    process.exit(1);
  });
}

spawnAgent();