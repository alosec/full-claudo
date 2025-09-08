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

export interface ParserOptions {
  agentName?: string;
  useColors?: boolean;
  verboseErrors?: boolean;
  fallbackToRaw?: boolean;
  maxOutputLength?: number;
  enableHeartbeat?: boolean;
}

export class ClaudeStreamParser extends Transform {
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
  private lastOutputTime: number = Date.now();
  private enableHeartbeat: boolean;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private outputHealthy: boolean = true;

  constructor(agentName: string | ParserOptions = 'Agent', useColors?: boolean) {
    super({ objectMode: false });
    
    // Handle both old and new constructor signatures
    if (typeof agentName === 'string') {
      this.agentName = agentName;
      this.useColors = (useColors !== false) && process.stdout.isTTY;
      this.verboseErrors = false;
      this.fallbackToRaw = true;
      this.maxOutputLength = 1000;
      this.enableHeartbeat = true;
    } else {
      const options = agentName;
      this.agentName = options.agentName || 'Agent';
      this.useColors = (options.useColors !== false) && process.stdout.isTTY;
      this.verboseErrors = options.verboseErrors || false;
      this.fallbackToRaw = options.fallbackToRaw !== false;
      this.maxOutputLength = options.maxOutputLength || 1000;
      this.enableHeartbeat = options.enableHeartbeat !== false;
    }

    // Start heartbeat monitoring to detect console.log failures
    if (this.enableHeartbeat) {
      this.startHeartbeat();
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const timeSinceLastOutput = Date.now() - this.lastOutputTime;
      
      // If no output for more than 2 seconds, try to force output
      if (timeSinceLastOutput > 2000 && this.outputHealthy) {
        this.outputHealthy = false;
        
        // Try multiple output methods
        this.forceOutput(`[${this.agentName}] ⚠️ Output may be delayed (${(timeSinceLastOutput/1000).toFixed(1)}s since last output)`);
        
        // Force flush stdout
        if (process.stdout.write('')) {
          process.stdout.emit('drain');
        }
      } else if (timeSinceLastOutput < 1000) {
        this.outputHealthy = true;
      }
    }, 500);
  }

  private forceOutput(message: string) {
    // Try multiple methods to output
    try {
      // Method 1: Regular console.log
      console.log(message);
      
      // Method 2: Direct stdout write
      process.stdout.write(message + '\n');
      
      // Method 3: stderr as fallback
      if (!this.outputHealthy) {
        process.stderr.write(`[FALLBACK] ${message}\n`);
      }
      
      this.lastOutputTime = Date.now();
    } catch (e) {
      // Last resort: stderr
      process.stderr.write(`[ERROR] Failed to output: ${e}\n`);
    }
  }

  _transform(chunk: any, encoding: string, callback: Function) {
    try {
      this.buffer += chunk.toString();
      
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        this.lineCount++;
        if (line.trim()) {
          this.processLine(line);
        }
      }
      
      // Don't pass through data - we're a terminal consumer
      callback();
    } catch (error) {
      this.handleError('_transform', error);
      callback();
    }
  }

  _flush(callback: Function) {
    try {
      // Process any remaining buffer content
      if (this.buffer.trim()) {
        this.processLine(this.buffer);
      }
      
      // Clean up heartbeat
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }
      
      // Output final statistics if verbose
      if (this.verboseErrors && (this.errorCount > 0 || this.lineCount > 100)) {
        this.forceOutput(`[${this.agentName}] Parser Statistics: lines=${this.lineCount}, success=${this.successCount}, errors=${this.errorCount}`);
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
        this.forceOutput(`[${this.agentName}] JSON parse error at line ${this.lineCount}: ${parseError}`);
      }
      
      // Fallback to raw output if enabled
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
          this.safeOutput(`${prefix} ${this.formatColor('[RAW TEXT]', 'yellow')} ${textMatch[1]}`);
          return;
        }
      }
      
      if (line.includes('"type":"tool_use"')) {
        const toolMatch = line.match(/"name"\s*:\s*"([^"]*)/);
        if (toolMatch) {
          this.safeOutput(`${prefix} ${this.formatColor('[RAW TOOL]', 'yellow')} ${toolMatch[1]}`);
          return;
        }
      }
      
      const truncated = line.length > 100 ? line.substring(0, 100) + '...' : line;
      this.safeOutput(`${prefix} ${this.formatColor('[RAW]', 'red')} ${truncated}`);
    } catch (e) {
      if (this.verboseErrors) {
        this.forceOutput(`[${this.agentName}] Failed to output raw line: ${e}`);
      }
    }
  }

  private safeOutput(text: string) {
    try {
      console.log(text);
      this.lastOutputTime = Date.now();
      this.outputHealthy = true;
    } catch (e) {
      this.forceOutput(text);
    }
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
        this.safeOutput(`${prefix} ${this.formatColor('[Unknown message type]', 'yellow')} ${message.type}`);
      }
    } catch (error) {
      this.handleError('processMessage', error, message);
    }
  }

  private processAssistantMessage(prefix: string, content: any[]) {
    try {
      if (!Array.isArray(content)) {
        if (this.verboseErrors) {
          this.forceOutput(`${prefix} Warning: content is not an array`);
        }
        return;
      }

      for (const item of content) {
        try {
          if (item.type === 'text' && item.text) {
            if (this.lastWasToolResult) {
              this.safeOutput('');
              this.lastWasToolResult = false;
            }
            
            const safeText = String(item.text || '').substring(0, this.maxOutputLength);
            this.safeOutput(`${prefix} ${safeText}`);
          } else if (item.type === 'tool_use' && item.id) {
            const toolName = item.name || 'Unknown';
            const toolInfo = this.formatToolInput(toolName, item.input || {});
            this.safeOutput(`${prefix} ${this.formatColor('→', 'cyan')} ${this.formatColor(toolName, 'yellow')}: ${toolInfo}`);
            
            this.pendingTools.set(item.id, {
              name: toolName,
              input: item.input,
              startTime: Date.now()
            });
          }
        } catch (itemError) {
          if (this.verboseErrors) {
            this.forceOutput(`${prefix} Error processing content item: ${itemError}`);
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
          this.forceOutput(`${prefix} Warning: content is not an array`);
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
              this.safeOutput(`${prefix} ${this.formatColor('✗', 'red')} Tool failed${timeStr}`);
              const errorPreview = this.truncateOutput(item.content, 2);
              if (errorPreview) {
                this.safeOutput(this.formatColor(`   ${errorPreview.replace(/\n/g, '\n   ')}`, 'red'));
              }
            } else {
              this.safeOutput(`${prefix} ${this.formatColor('✓', 'green')} Completed${timeStr}`);
              
              if (toolInfo && ['Bash', 'Grep'].includes(toolInfo.name) && item.content) {
                const preview = this.truncateOutput(item.content, 3);
                if (preview && preview.trim()) {
                  this.safeOutput(this.formatColor(`   ${preview.replace(/\n/g, '\n   ')}`, 'dim'));
                }
              }
            }
            
            this.lastWasToolResult = true;
            this.pendingTools.delete(item.tool_use_id);
          }
        } catch (itemError) {
          if (this.verboseErrors) {
            this.forceOutput(`${prefix} Error processing tool result: ${itemError}`);
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
      this.forceOutput(`[${this.agentName}] Error in ${context}: ${error instanceof Error ? error.message : error}`);
      
      if (data) {
        this.forceOutput(`[${this.agentName}] Related data: ${JSON.stringify(data).substring(0, 300)}`);
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
      outputHealthy: this.outputHealthy
    };
  }

  public destroy(error?: Error) {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
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
    useColors: !args.includes('--no-color'),
    enableHeartbeat: !args.includes('--no-heartbeat')
  };
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node parser.js [agent-name] [options]

Options:
  --verbose, -v     Show detailed error information
  --no-fallback     Disable fallback to raw output on parse errors
  --no-color        Disable colored output
  --no-heartbeat    Disable heartbeat monitoring
  --help, -h        Show this help message

The parser reads JSON stream from stdin and outputs formatted messages to stdout.
`);
    process.exit(0);
  }
  
  const parser = new ClaudeStreamParser(options);
  
  process.on('SIGINT', () => {
    const stats = parser.getStatistics();
    console.error(`\n[${agentName}] Interrupted. Statistics:`, stats);
    parser.destroy();
    process.exit(0);
  });
  
  process.stdin.pipe(parser);
}

export default ClaudeStreamParser;