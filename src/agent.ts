#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, mkdirSync } from 'fs';
import * as path from 'path';

// Spawn ephemeral Claude agent in Docker
function spawnAgent() {
  const [, , agentType, ...promptArgs] = process.argv;
  
  if (!agentType || !['plan', 'worker', 'critic', 'oracle'].includes(agentType)) {
    console.error('Usage: claudo {plan|worker|critic|oracle} <prompt>');
    process.exit(1);
  }

  // Map 'plan' to 'planner' for consistency
  const promptFile = agentType === 'plan' ? 'planner' : agentType;
  const basePrompt = readFileSync(`/usr/local/lib/claudo/prompts/${promptFile}.md`, 'utf8');
  const userPrompt = promptArgs.join(' ');
  
  const fullPrompt = `${basePrompt}\n\nTask: ${userPrompt}`;
  
  // Ensure .claudo directory exists
  const claudoDir = path.join(process.cwd(), '.claudo');
  mkdirSync(claudoDir, { recursive: true });
  
  // Write prompt to temporary file to avoid shell escaping issues
  const tempPromptFile = path.join(claudoDir, `${agentType}-prompt.txt`);
  require('fs').writeFileSync(tempPromptFile, fullPrompt);
  
  // Run ephemeral container (no name, auto-remove)
  const cmd = `docker run --rm \\
    -v "$(pwd):/workspace" \\
    -v "$HOME/.claude/.credentials.json:/home/node/.claude/.credentials.json:ro" \\
    -v "$HOME/.claude/settings.json:/home/node/.claude/settings.json:ro" \\
    claudo-container \\
    sh -c 'claude -p "$(cat /workspace/.claudo/${agentType}-prompt.txt)" --dangerously-skip-permissions --output-format stream-json --verbose --model sonnet'`;
  
  execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
}

spawnAgent();