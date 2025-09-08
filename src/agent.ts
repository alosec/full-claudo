#!/usr/bin/env node

import { spawn } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import * as path from 'path';
import { ClaudeStreamParser } from './parser';

// Spawn Claude agent as Node.js process within container
function spawnAgent() {
  const [, , agentType, ...promptArgs] = process.argv;
  
  if (!agentType || !['plan', 'worker', 'critic', 'oracle'].includes(agentType)) {
    console.error('Usage: claudo {plan|worker|critic|oracle} <prompt>');
    process.exit(1);
  }

  // Map 'plan' to 'planner' for consistency
  const promptFile = agentType === 'plan' ? 'planner' : agentType;
  
  // Read prompts from container's installed location
  const basePrompt = readFileSync(`/usr/local/lib/claudo/prompts/${promptFile}.md`, 'utf8');
  
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
  
  // Spawn Claude process
  const claude = spawn('claude', [
    '-p', `$(cat ${tempPromptFile})`,
    '--dangerously-skip-permissions',
    '--output-format', 'stream-json',
    '--input-format', inputFormat,
    '--verbose',
    '--model', 'sonnet'
  ], {
    stdio: ['pipe', 'pipe', 'inherit'],
    shell: true
  });
  
  // Set up stream parsing for human-readable output
  const parser = new ClaudeStreamParser(agentType.charAt(0).toUpperCase() + agentType.slice(1));
  
  // Connect streams
  if (hasInput) {
    process.stdin.pipe(claude.stdin);
  }
  
  claude.stdout.pipe(parser);
  
  claude.on('close', (code) => {
    process.exit(code || 0);
  });
}

spawnAgent();