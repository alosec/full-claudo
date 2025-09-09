#!/usr/bin/env node

import { spawn } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import * as path from 'path';

// Spawn Claude agent as Node.js process within container
function spawnAgent() {
  const [, , agentType, ...promptArgs] = process.argv;
  
  if (!agentType || !['plan', 'worker', 'critic', 'oracle'].includes(agentType)) {
    console.error('Usage: claudo {plan|worker|critic|oracle} <prompt>');
    process.exit(1);
  }

  // Map 'plan' to 'planner' for consistency
  const promptFile = agentType === 'plan' ? 'planner' : agentType;
  
  // Read prompts from workspace location
  const basePrompt = readFileSync(`/workspace/prompts/${promptFile}.md`, 'utf8');
  
  const userPrompt = promptArgs.join(' ');
  const fullPrompt = `${basePrompt}\n\nTask: ${userPrompt}`;
  
  // Ensure .claudo directory exists
  const claudoDir = path.join(process.cwd(), '.claudo');
  mkdirSync(claudoDir, { recursive: true });
  
  // Write prompt to temporary file
  const tempPromptFile = path.join(claudoDir, `${agentType}-prompt.txt`);
  writeFileSync(tempPromptFile, fullPrompt);
  
  // Determine input format based on stdin
  const hasInput = !process.stdin.isTTY;
  const inputFormat = hasInput ? 'stream-json' : 'text';
  
  // Spawn Claude process - capture session ID and provide clean text output
  const claude = spawn('claude', [
    '-p', `$(cat ${tempPromptFile})`,
    '--dangerously-skip-permissions',
    '--input-format', inputFormat,
    '--model', 'sonnet',
    '--verbose' // Needed to get session ID in stderr
  ], {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true
  });
  
  let sessionId = '';
  let responseBuffer = '';
  
  // Capture session ID from verbose output (stderr)
  claude.stderr?.on('data', (data) => {
    const output = data.toString();
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
  
  // Connect streams - direct text input to subagent
  if (hasInput) {
    process.stdin.pipe(claude.stdin);
  }
  
  claude.on('close', (code) => {
    // Output clean response to Manager
    if (responseBuffer) {
      process.stdout.write(responseBuffer);
    }
    process.exit(code || 0);
  });
}

spawnAgent();