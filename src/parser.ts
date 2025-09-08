#!/usr/bin/env node

import { Transform } from 'stream';
import { appendFileSync } from 'fs';

interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: any;
}

interface TextContent {
  type: 'text';
  text: string;
}

interface ToolResultContent {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

interface AssistantMessage {
  type: 'assistant';
  message?: {
    content: Array<TextContent | ToolUseContent>;
  };
}

interface UserMessage {
  type: 'user';
  message?: {
    content: Array<ToolResultContent>;
  };
}

type StreamMessage = AssistantMessage | UserMessage;

export interface ParserOptions {
  agentName?: string;
  useColors?: boolean;
  outputFile?: string;
}

export class ClaudeStreamParser extends Transform {
  private agentName: string;
  private buffer: string = '';
  private pendingTools: Map<string, { name: string; input: any; startTime: number }> = new Map();
  private useColors: boolean;
  private lastWasToolResult: boolean = false;
  private outputFile?: string;

  constructor(options: string | ParserOptions = 'Agent', useColors: boolean = true) {
    super({ objectMode: true });
    
    // Handle both old string-based constructor and new options object
    if (typeof options === 'string') {
      this.agentName = options;
      this.useColors = useColors && process.stdout.isTTY;
      this.outputFile = undefined;
    } else {
      this.agentName = options.agentName || 'Agent';
      this.useColors = (options.useColors !== false) && process.stdout.isTTY;
      this.outputFile = options.outputFile;
    }
  }
  
  private output(text: string) {
    if (this.outputFile) {
      // Write to file instead of console
      appendFileSync(this.outputFile, text + '\n');
    } else {
      // Write to console
      console.log(text);
    }
  }
  
  private outputError(text: string) {
    if (this.outputFile) {
      // Write errors to file too
      appendFileSync(this.outputFile, text + '\n');
    } else {
      console.error(text);
    }
  }

  _transform(chunk: any, encoding: string, callback: Function) {
    try {
      this.buffer += chunk.toString();
      
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const message: StreamMessage = JSON.parse(line);
            this.processMessage(message);
          } catch (e) {
            // Log JSON parsing errors for debugging with fallback display
            this.outputError(`[${this.agentName}] JSON parse error: ${e instanceof Error ? e.message : e}`);
            this.outputError(`[${this.agentName}] Problematic line: ${line.substring(0, 200)}`);
            
            // Fallback: show raw content if it looks like meaningful output
            if (line.length > 10 && !line.startsWith('{')) {
              this.output(`[${this.agentName}] Raw: ${line}`);
            }
          }
        }
      }
      
      // Pass through original data for any downstream consumers
      this.push(chunk);
      callback();
    } catch (e) {
      // Catch any errors in the entire transform process
      this.outputError(`[${this.agentName}] Transform error: ${e instanceof Error ? e.message : e}`);
      this.outputError(`[${this.agentName}] Chunk: ${chunk.toString().substring(0, 100)}`);
      
      // Still pass through the chunk and continue processing
      this.push(chunk);
      callback();
    }
  }

  private formatColor(text: string, color: string): string {
    if (!this.useColors) return text;
    const colors: { [key: string]: string } = {
      'bright': '\x1b[1m',
      'cyan': '\x1b[36m',
      'yellow': '\x1b[33m',
      'green': '\x1b[32m',
      'red': '\x1b[31m',
      'gray': '\x1b[90m',
      'dim': '\x1b[2m',
      'reset': '\x1b[0m'
    };
    return `${colors[color] || ''}${text}\x1b[0m`;
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
    try {
      const prefix = `[${this.formatColor(this.agentName, 'bright')}]`;
      
      if (message.type === 'assistant' && message.message?.content) {
        for (const content of message.message.content) {
          if (content.type === 'text' && content.text) {
            // Add spacing after tool results
            if (this.lastWasToolResult) {
              this.output('');
              this.lastWasToolResult = false;
            }
            this.output(`${prefix} ${content.text}`);
          } else if (content.type === 'tool_use' && content.id) {
            const toolName = content.name || 'Unknown';
            const toolInfo = this.formatToolInput(toolName, content.input || {});
            this.output(`${prefix} ${this.formatColor('→', 'cyan')} ${this.formatColor(toolName, 'yellow')}: ${toolInfo}`);
            
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
              this.output(`${prefix} ${this.formatColor('✗', 'red')} Tool failed${timeStr}`);
              const errorPreview = this.truncateOutput(content.content, 2);
              if (errorPreview) {
                this.output(this.formatColor(`   ${errorPreview.replace(/\n/g, '\n   ')}`, 'red'));
              }
            } else {
              this.output(`${prefix} ${this.formatColor('✓', 'green')} Completed${timeStr}`);
              
              // Show abbreviated output for certain tools
              if (toolInfo && ['Bash', 'Grep'].includes(toolInfo.name) && content.content) {
                const preview = this.truncateOutput(content.content, 3);
                if (preview && preview.trim()) {
                  this.output(this.formatColor(`   ${preview.replace(/\n/g, '\n   ')}`, 'dim'));
                }
              }
            }
            
            this.lastWasToolResult = true;
            this.pendingTools.delete(content.tool_use_id);
          }
        }
      }
    } catch (e) {
      this.outputError(`[${this.agentName}] Error processing message: ${e instanceof Error ? e.message : e}`);
      this.outputError(`[${this.agentName}] Message: ${JSON.stringify(message).substring(0, 300)}`);
    }
  }
}

// CLI usage: node parser.js [agent-name]
if (require.main === module) {
  const agentName = process.argv[2] || 'Agent';
  const parser = new ClaudeStreamParser(agentName);
  
  process.stdin.pipe(parser).pipe(process.stdout);
}

export default ClaudeStreamParser;