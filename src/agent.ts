#!/usr/bin/env node

import { spawn } from 'child_process';
import { writeFileSync, mkdirSync, readFileSync, readdirSync, statSync } from 'fs';
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
  
  // Check if we're being called with --print flag (e.g., by Manager)
  const isPrint = process.argv.includes('--print') || process.env.CLAUDO_AGENT_PRINT === 'true';
  
  let claudeArgs: string[];
  if (isPrint) {
    // Print mode: Single clean response for Manager consumption
    claudeArgs = [
      '--dangerously-skip-permissions',
      '--model', 'sonnet',
      '--print'
    ];
  } else {
    // Default: Use stream-json for session tracking and monitoring
    claudeArgs = [
      '--dangerously-skip-permissions',
      '--model', 'sonnet',
      '--output-format', 'stream-json',
      '--verbose'  // Required with stream-json to get session ID
    ];
  }

  // Spawn Claude process - no shell needed since we're not using shell expansion
  const claude = spawn('claude', claudeArgs, {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false
  });
  
  let sessionId = '';
  let projectPath = '';
  let jsonBuffer = '';  // Collect JSON stream output
  let textResponse = '';  // Final text response to return
  
  // With stream-json, the session file is automatically created
  // We need to find it by monitoring the project directory
  const projectDir = path.join(
    process.env.HOME || '',
    '.claude',
    'projects',
    process.cwd().replace(/\//g, '-')
  );
  
  // Capture stderr for any errors
  claude.stderr?.on('data', (data) => {
    const output = data.toString();
    if (process.env.DEBUG_AGENT) {
      console.error(`[agent-debug] Stderr: ${output}`);
    }
  });
  
  // Handle output based on mode
  claude.stdout?.on('data', (data) => {
    if (isPrint) {
      // In print mode, stdout is the direct text response
      textResponse += data.toString();
    } else {
      // Parse JSON stream to extract text response and find session file
      jsonBuffer += data.toString();
      const lines = jsonBuffer.split('\n');
      jsonBuffer = lines.pop() || ''; // Keep incomplete line
      
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          // Extract text content from assistant messages
          if (msg.type === 'assistant' && msg.message?.content) {
            for (const content of msg.message.content) {
              if (content.type === 'text' && content.text) {
                textResponse += content.text;
              }
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  });
  
  // Write prompt to stdin and close it
  claude.stdin?.write(promptContent);
  claude.stdin?.end();
  
  claude.on('close', async (code) => {
    // Output the clean text response (not JSON)
    if (textResponse) {
      process.stdout.write(textResponse);
    }
    
    // Find the session file that was just created
    try {
      mkdirSync(projectDir, { recursive: true });
      const files = readdirSync(projectDir)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => ({
          name: f,
          path: path.join(projectDir, f),
          mtime: statSync(path.join(projectDir, f)).mtime
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      
      if (files.length > 0) {
        // Most recent file is likely our session
        sessionId = files[0].name.replace('.jsonl', '');
        
        // Write metadata for logs monitoring
        const metadataFile = path.join(claudoDir, `${agentType}-metadata.json`);
        writeFileSync(metadataFile, JSON.stringify({
          sessionId,
          projectPath: projectDir,
          agentType,
          timestamp: new Date().toISOString(),
          sessionFile: files[0].path
        }, null, 2));
        
        if (process.env.DEBUG_AGENT) {
          console.error(`[agent-debug] Session found: ${sessionId}`);
          console.error(`[agent-debug] Session file: ${files[0].path}`);
        }
      }
    } catch (e) {
      if (process.env.DEBUG_AGENT) {
        console.error(`[agent-debug] Failed to find session: ${e}`);
      }
    }
    
    process.exit(code || 0);
  });
  
  claude.on('error', (error) => {
    console.error('[claudo] Error spawning Claude:', error.message);
    process.exit(1);
  });
}

spawnAgent();