#!/usr/bin/env node

import { Transform } from 'stream';

interface ClaudeMessage {
  type: 'assistant' | 'user';
  message?: {
    id: string;
    role: string;
    content: Array<{
      type: 'text' | 'tool_use';
      text?: string;
      name?: string;
      id?: string;
      input?: any;
    }>;
  };
}

interface ToolResult {
  type: 'user';
  message?: {
    role: string;
    content: Array<{
      type: 'tool_result';
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    }>;
  };
}

type StreamMessage = ClaudeMessage | ToolResult;

class ClaudeStreamParser extends Transform {
  private agentName: string;
  private buffer: string = '';

  constructor(agentName: string = 'Agent') {
    super({ objectMode: true });
    this.agentName = agentName;
  }

  _transform(chunk: any, encoding: string, callback: Function) {
    this.buffer += chunk.toString();
    
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line in buffer
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const message: StreamMessage = JSON.parse(line);
          this.processMessage(message);
        } catch (e) {
          // Skip invalid JSON lines
        }
      }
    }
    
    // Pass through original data for any downstream consumers
    this.push(chunk);
    callback();
  }

  private processMessage(message: StreamMessage) {
    if (message.type === 'assistant' && message.message?.content) {
      for (const content of message.message.content) {
        if (content.type === 'text' && content.text) {
          console.log(`[${this.agentName}] ${content.text}`);
        } else if (content.type === 'tool_use') {
          const toolName = content.name || 'Unknown';
          console.log(`[${this.agentName}] 🔧 Using ${toolName}...`);
        }
      }
    } else if (message.type === 'user' && message.message?.content) {
      for (const content of message.message.content) {
        if (content.type === 'tool_result') {
          if (content.is_error) {
            console.log(`[${this.agentName}] ❌ Tool failed: ${content.content}`);
          } else {
            console.log(`[${this.agentName}] ✅ Tool completed`);
          }
        }
      }
    }
  }
}

// CLI usage: node parser.js [agent-name]
if (require.main === module) {
  const agentName = process.argv[2] || 'Agent';
  const parser = new ClaudeStreamParser(agentName);
  
  process.stdin.pipe(parser).pipe(process.stdout);
}

export { ClaudeStreamParser };