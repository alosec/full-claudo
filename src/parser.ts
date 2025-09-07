#!/usr/bin/env node

import { Transform } from 'stream';

// Complete Claude streaming JSON message types
interface AssistantMessage {
  type: 'assistant';
  message?: {
    id: string;
    type: 'message';
    role: 'assistant';
    model: string;
    content: Array<{
      type: 'text' | 'tool_use';
      text?: string;
      id?: string;
      name?: string;
      input?: {
        command?: string;
        description?: string;
        file_path?: string;
        old_string?: string;
        new_string?: string;
        [key: string]: any;
      };
    }>;
    stop_reason?: string | null;
    stop_sequence?: string | null;
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
  parent_tool_use_id?: string | null;
  session_id?: string;
  uuid?: string;
}

interface UserMessage {
  type: 'user';
  message?: {
    role: 'user';
    content: Array<{
      type: 'tool_result';
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    }>;
  };
  parent_tool_use_id?: string | null;
  session_id?: string;
  uuid?: string;
}

type StreamMessage = AssistantMessage | UserMessage;

class ClaudeStreamParser extends Transform {
  private agentName: string;
  private buffer: string = '';
  private pendingTools: Map<string, { name: string; input: any; startTime: number }> = new Map();
  private useColors: boolean;
  private lastWasToolResult: boolean = false;

  constructor(agentName: string = 'Agent', useColors: boolean = true) {
    super({ objectMode: true });
    this.agentName = agentName;
    this.useColors = useColors && process.stdout.isTTY;
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

  private formatColor(text: string, color: string): string {
    if (!this.useColors) return text;
    const colors: { [key: string]: string } = {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      dim: '\x1b[2m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      cyan: '\x1b[36m',
      gray: '\x1b[90m'
    };
    return `${colors[color] || ''}${text}${colors.reset || ''}`;
  }

  private formatTimestamp(): string {
    const now = new Date();
    const time = now.toTimeString().split(' ')[0];
    return this.formatColor(time, 'gray');
  }

  private truncateOutput(text: string, maxLines: number = 3): string {
    const lines = text.split('\n');
    if (lines.length <= maxLines) return text;
    return lines.slice(0, maxLines).join('\n') + 
           this.formatColor(`\n... (${lines.length - maxLines} more lines)`, 'dim');
  }

  private formatToolInput(name: string, input: any): string {
    switch (name) {
      case 'Bash':
        return input.command ? `$ ${input.command}` : 'Running command...';
      case 'Read':
        return input.file_path ? `Reading ${input.file_path}` : 'Reading file...';
      case 'Edit':
      case 'Write':
        return input.file_path ? `Editing ${input.file_path}` : 'Editing file...';
      case 'Grep':
        return input.pattern ? `Searching for: ${input.pattern}` : 'Searching...';
      default:
        return JSON.stringify(input).substring(0, 100);
    }
  }

  private processMessage(message: StreamMessage) {
    const prefix = `[${this.formatColor(this.agentName, 'bright')}]`;
    
    if (message.type === 'assistant' && message.message?.content) {
      for (const content of message.message.content) {
        if (content.type === 'text' && content.text) {
          // Add spacing after tool results
          if (this.lastWasToolResult) {
            console.log();
            this.lastWasToolResult = false;
          }
          console.log(`${prefix} ${content.text}`);
        } else if (content.type === 'tool_use' && content.id) {
          const toolName = content.name || 'Unknown';
          const toolInfo = this.formatToolInput(toolName, content.input || {});
          console.log(`${prefix} ${this.formatColor('→', 'cyan')} ${this.formatColor(toolName, 'yellow')}: ${toolInfo}`);
          
          // Store tool info for matching with results
          this.pendingTools.set(content.id, {
            name: toolName,
            input: content.input,
            startTime: Date.now()
          });
        }
      }
    } else if (message.type === 'user' && message.message?.content) {
      for (const content of message.message.content) {
        if (content.type === 'tool_result') {
          const toolInfo = this.pendingTools.get(content.tool_use_id);
          const elapsed = toolInfo ? ((Date.now() - toolInfo.startTime) / 1000).toFixed(1) : null;
          const timeStr = elapsed ? ` ${this.formatColor(`(${elapsed}s)`, 'gray')}` : '';
          
          if (content.is_error) {
            console.log(`${prefix} ${this.formatColor('✗', 'red')} Tool failed${timeStr}`);
            const errorPreview = this.truncateOutput(content.content, 2);
            if (errorPreview) {
              console.log(this.formatColor(`   ${errorPreview.replace(/\n/g, '\n   ')}`, 'red'));
            }
          } else {
            console.log(`${prefix} ${this.formatColor('✓', 'green')} Completed${timeStr}`);
            
            // Show abbreviated output for certain tools
            if (toolInfo && ['Bash', 'Grep'].includes(toolInfo.name) && content.content) {
              const preview = this.truncateOutput(content.content, 3);
              if (preview && preview.trim()) {
                console.log(this.formatColor(`   ${preview.replace(/\n/g, '\n   ')}`, 'dim'));
              }
            }
          }
          
          this.lastWasToolResult = true;
          this.pendingTools.delete(content.tool_use_id);
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