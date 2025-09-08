#!/usr/bin/env node

import { Transform } from 'stream';
import * as fs from 'fs';

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
  verboseErrors?: boolean;
  fallbackToRaw?: boolean;
  maxOutputLength?: number;
  outputFd?: number; // File descriptor for output (default: 1 for stdout)
  errorFd?: number;  // File descriptor for errors (default: 2 for stderr)
}

export class BulletproofParser extends Transform {
  private agentName: string;
  private buffer: string = '';
  private pendingTools: Map<string, { name: string; input: any; startTime: number }> = new Map();
  private useColors: boolean;
  private lastWasToolResult: boolean = false;
  private verboseErrors: boolean;
  private fallbackToRaw: boolean;
  private maxOutputLength: number;
  private errorCount: number = 0;
  private lineCount: number = 0;
  private successCount: number = 0;
  private outputFd: number;
  private errorFd: number;
  private outputBuffer: string[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(options: ParserOptions = {}) {
    super({ objectMode: false });
    
    this.agentName = options.agentName || 'Agent';
    this.useColors = (options.useColors !== false) && process.stdout.isTTY;
    this.verboseErrors = options.verboseErrors || false;
    this.fallbackToRaw = options.fallbackToRaw !== false;
    this.maxOutputLength = options.maxOutputLength || 1000;
    this.outputFd = options.outputFd ?? 1; // stdout
    this.errorFd = options.errorFd ?? 2;  // stderr
    
    // Periodic flush to ensure output
    this.startPeriodicFlush();
  }

  private startPeriodicFlush() {
    this.flushTimer = setInterval(() => {
      this.flushOutput();
    }, 100); // Flush every 100ms
  }

  private writeDirectly(message: string, fd?: number) {
    const targetFd = fd ?? this.outputFd;
    const buffer = Buffer.from(message + '\n');
    
    try {
      // Direct synchronous write to file descriptor
      fs.writeSync(targetFd, buffer);
    } catch (e) {
      // If primary FD fails, try stderr
      if (targetFd !== this.errorFd) {
        try {
          fs.writeSync(this.errorFd, Buffer.from(`[FALLBACK] ${message}\n`));
        } catch (e2) {
          // Absolute last resort - buffer it
          this.outputBuffer.push(message);
        }
      }
    }
  }

  private flushOutput() {
    if (this.outputBuffer.length > 0) {
      const messages = this.outputBuffer.splice(0, this.outputBuffer.length);
      for (const msg of messages) {
        this.writeDirectly(msg);
      }
    }
  }

  private output(message: string) {
    // Always use direct write for reliability
    this.writeDirectly(message);
  }

  private error(message: string) {
    this.writeDirectly(message, this.errorFd);
  }

  _transform(chunk: any, encoding: string, callback: Function) {
    try {
      this.buffer += chunk.toString();
      
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() || '';
      
      for (const line of lines) {
        this.lineCount++;
        if (line.trim()) {
          this.processLine(line);
        }
      }
      
      callback();
    } catch (error) {
      this.handleError('_transform', error);
      callback();
    }
  }

  _flush(callback: Function) {
    try {
      if (this.buffer.trim()) {
        this.processLine(this.buffer);
      }
      
      this.flushOutput();
      
      if (this.flushTimer) {
        clearInterval(this.flushTimer);
      }
      
      if (this.verboseErrors && (this.errorCount > 0 || this.lineCount > 100)) {
        this.output(`[${this.agentName}] Parser Statistics: lines=${this.lineCount}, success=${this.successCount}, errors=${this.errorCount}`);
      }
      
      callback();
    } catch (error) {
      this.handleError('_flush', error);
      callback();
    }
  }

  private processLine(line: string) {
    try {
      const message: StreamMessage = JSON.parse(line);
      this.processMessage(message);
      this.successCount++;
    } catch (parseError) {
      this.errorCount++;
      
      if (this.verboseErrors) {
        this.error(`[${this.agentName}] JSON parse error at line ${this.lineCount}: ${parseError}`);
      }
      
      if (this.fallbackToRaw) {
        this.outputRawLine(line);
      }
    }
  }

  private outputRawLine(line: string) {
    try {
      const prefix = `[${this.formatColor(this.agentName, 'bright')}]`;
      
      if (line.includes('"type":"text"')) {
        const textMatch = line.match(/"text"\s*:\s*"([^"]*)/);
        if (textMatch) {
          this.output(`${prefix} ${this.formatColor('[RAW TEXT]', 'yellow')} ${textMatch[1]}`);
          return;
        }
      }
      
      if (line.includes('"type":"tool_use"')) {
        const toolMatch = line.match(/"name"\s*:\s*"([^"]*)/);
        if (toolMatch) {
          this.output(`${prefix} ${this.formatColor('[RAW TOOL]', 'yellow')} ${toolMatch[1]}`);
          return;
        }
      }
      
      const truncated = line.length > 100 ? line.substring(0, 100) + '...' : line;
      this.output(`${prefix} ${this.formatColor('[RAW]', 'red')} ${truncated}`);
    } catch (e) {
      if (this.verboseErrors) {
        this.error(`[${this.agentName}] Failed to output raw line: ${e}`);
      }
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
    try {
      const safeText = String(text || '');
      const lines = safeText.split('\n');
      
      if (lines.length <= maxLines) return safeText;
      
      return lines.slice(0, maxLines).join('\n') +
             this.formatColor(`\n... (${lines.length - maxLines} more lines)`, 'dim');
    } catch (e) {
      return this.formatColor('[truncation failed]', 'red');
    }
  }

  private formatToolInput(name: string, input: any): string {
    try {
      if (!input) return `${name}: [no input]`;
      
      switch (name) {
        case 'Bash':
          return input.command ? `$ ${String(input.command).substring(0, 100)}` : 'Running command...';
        case 'Read':
          return input.file_path ? `Reading ${String(input.file_path)}` : 'Reading file...';
        case 'Edit':
        case 'Write':
          return input.file_path ? `Editing ${String(input.file_path)}` : 'Editing file...';
        case 'Grep':
          return input.pattern ? `Searching for: ${String(input.pattern).substring(0, 50)}` : 'Searching...';
        case 'Glob':
          return JSON.stringify(input).substring(0, 100);
        default:
          try {
            const str = JSON.stringify(input);
            return str.substring(0, 100);
          } catch {
            return '[complex object]';
          }
      }
    } catch (e) {
      return `${name}: [format error]`;
    }
  }

  private processMessage(message: StreamMessage) {
    try {
      const prefix = `[${this.formatColor(this.agentName, 'bright')}]`;
      
      if (message.type === 'assistant' && message.message?.content) {
        this.processAssistantMessage(prefix, message.message.content);
      } else if (message.type === 'user' && message.message?.content) {
        this.processUserMessage(prefix, message.message.content);
      } else if (this.verboseErrors) {
        this.output(`${prefix} ${this.formatColor('[Unknown message type]', 'yellow')} ${message.type}`);
      }
    } catch (error) {
      this.handleError('processMessage', error, message);
    }
  }

  private processAssistantMessage(prefix: string, content: any[]) {
    try {
      if (!Array.isArray(content)) {
        if (this.verboseErrors) {
          this.error(`${prefix} Warning: content is not an array`);
        }
        return;
      }
      
      for (const item of content) {
        try {
          if (item.type === 'text' && item.text) {
            if (this.lastWasToolResult) {
              this.output('');
              this.lastWasToolResult = false;
            }
            
            const safeText = String(item.text || '').substring(0, this.maxOutputLength);
            this.output(`${prefix} ${safeText}`);
          } else if (item.type === 'tool_use' && item.id) {
            const toolName = item.name || 'Unknown';
            const toolInfo = this.formatToolInput(toolName, item.input || {});
            this.output(`${prefix} ${this.formatColor('→', 'cyan')} ${this.formatColor(toolName, 'yellow')}: ${toolInfo}`);
            
            this.pendingTools.set(item.id, {
              name: toolName,
              input: item.input,
              startTime: Date.now()
            });
          }
        } catch (itemError) {
          if (this.verboseErrors) {
            this.error(`${prefix} Error processing content item: ${itemError}`);
          }
        }
      }
    } catch (error) {
      this.handleError('processAssistantMessage', error);
    }
  }

  private processUserMessage(prefix: string, content: any[]) {
    try {
      if (!Array.isArray(content)) {
        if (this.verboseErrors) {
          this.error(`${prefix} Warning: content is not an array`);
        }
        return;
      }
      
      for (const item of content) {
        try {
          if (item.type === 'tool_result') {
            const toolInfo = this.pendingTools.get(item.tool_use_id);
            const elapsed = toolInfo ? ((Date.now() - toolInfo.startTime) / 1000).toFixed(1) : null;
            const timeStr = elapsed ? ` ${this.formatColor(`(${elapsed}s)`, 'gray')}` : '';
            
            if (item.is_error) {
              this.output(`${prefix} ${this.formatColor('✗', 'red')} Tool failed${timeStr}`);
              const errorPreview = this.truncateOutput(item.content, 2);
              if (errorPreview) {
                this.output(this.formatColor(`   ${errorPreview.replace(/\n/g, '\n   ')}`, 'red'));
              }
            } else {
              this.output(`${prefix} ${this.formatColor('✓', 'green')} Completed${timeStr}`);
              
              if (toolInfo && ['Bash', 'Grep'].includes(toolInfo.name) && item.content) {
                const preview = this.truncateOutput(item.content, 3);
                if (preview && preview.trim()) {
                  this.output(this.formatColor(`   ${preview.replace(/\n/g, '\n   ')}`, 'dim'));
                }
              }
            }
            
            this.lastWasToolResult = true;
            this.pendingTools.delete(item.tool_use_id);
          }
        } catch (itemError) {
          if (this.verboseErrors) {
            this.error(`${prefix} Error processing tool result: ${itemError}`);
          }
        }
      }
    } catch (error) {
      this.handleError('processUserMessage', error);
    }
  }

  private handleError(context: string, error: any, data?: any) {
    this.errorCount++;
    
    if (this.verboseErrors) {
      this.error(`[${this.agentName}] Error in ${context}: ${error instanceof Error ? error.message : error}`);
      
      if (data) {
        this.error(`[${this.agentName}] Related data: ${JSON.stringify(data).substring(0, 300)}`);
      }
    }
    
    this.emit('parser-error', { context, error, data });
  }

  public getStatistics() {
    return {
      lines: this.lineCount,
      success: this.successCount,
      errors: this.errorCount,
      errorRate: this.lineCount > 0 ? (this.errorCount / this.lineCount) * 100 : 0,
      pendingTools: this.pendingTools.size,
      bufferedOutput: this.outputBuffer.length
    };
  }

  public destroy(error?: Error) {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flushOutput();
    super.destroy(error);
    return this;
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const agentName = args[0] || 'Agent';
  
  const options: ParserOptions = {
    agentName,
    verboseErrors: args.includes('--verbose') || args.includes('-v'),
    fallbackToRaw: !args.includes('--no-fallback'),
    useColors: !args.includes('--no-color')
  };
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node parser-v2.js [agent-name] [options]

Options:
  --verbose, -v     Show detailed error information
  --no-fallback     Disable fallback to raw output on parse errors
  --no-color        Disable colored output
  --help, -h        Show this help message

The parser reads JSON stream from stdin and outputs formatted messages to stdout.
`);
    process.exit(0);
  }
  
  const parser = new BulletproofParser(options);
  
  process.on('SIGINT', () => {
    const stats = parser.getStatistics();
    console.error(`\n[${agentName}] Interrupted. Statistics:`, stats);
    parser.destroy();
    process.exit(0);
  });
  
  process.stdin.pipe(parser);
}

export default BulletproofParser;