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

interface ParserOptions {
  agentName?: string;
  useColors?: boolean;
  verboseErrors?: boolean;
  fallbackToRaw?: boolean;
  maxOutputLength?: number;
}

class ImprovedClaudeStreamParser extends Transform {
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

  constructor(options: ParserOptions = {}) {
    super({ objectMode: true });
    this.agentName = options.agentName || 'Agent';
    this.useColors = (options.useColors !== false) && process.stdout.isTTY;
    this.verboseErrors = options.verboseErrors || false;
    this.fallbackToRaw = options.fallbackToRaw !== false; // Default true
    this.maxOutputLength = options.maxOutputLength || 1000;
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
      
      // Pass through original data for any downstream consumers
      this.push(chunk);
      callback();
    } catch (error) {
      this.handleError('_transform', error);
      // Still continue processing
      callback();
    }
  }

  _flush(callback: Function) {
    try {
      // Process any remaining buffer content
      if (this.buffer.trim()) {
        this.processLine(this.buffer);
      }
      
      // Output final statistics if verbose
      if (this.verboseErrors && (this.errorCount > 0 || this.lineCount > 100)) {
        console.error(`[${this.agentName}] Parser Statistics:`, {
          lines: this.lineCount,
          success: this.successCount,
          errors: this.errorCount,
          errorRate: `${((this.errorCount / this.lineCount) * 100).toFixed(2)}%`
        });
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
        console.error(`[${this.agentName}] JSON parse error at line ${this.lineCount}:`, 
          parseError instanceof Error ? parseError.message : parseError);
        console.error(`[${this.agentName}] Problematic line (first 200 chars):`, 
          line.substring(0, 200));
      }
      
      // Fallback to raw output if enabled
      if (this.fallbackToRaw) {
        this.outputRawLine(line);
      }
    }
  }

  private outputRawLine(line: string) {
    try {
      // Try to extract some useful info even from malformed JSON
      const prefix = `[${this.formatColor(this.agentName, 'bright')}]`;
      
      if (line.includes('"type":"text"')) {
        // Try to extract text content
        const textMatch = line.match(/"text"\s*:\s*"([^"]*)/);
        if (textMatch) {
          console.log(`${prefix} ${this.formatColor('[RAW TEXT]', 'yellow')} ${textMatch[1]}`);
          return;
        }
      }
      
      if (line.includes('"type":"tool_use"')) {
        // Try to extract tool name
        const toolMatch = line.match(/"name"\s*:\s*"([^"]*)/);
        if (toolMatch) {
          console.log(`${prefix} ${this.formatColor('[RAW TOOL]', 'yellow')} ${toolMatch[1]}`);
          return;
        }
      }
      
      // Last resort: show truncated raw line
      const truncated = line.length > 100 ? line.substring(0, 100) + '...' : line;
      console.log(`${prefix} ${this.formatColor('[RAW]', 'red')} ${truncated}`);
    } catch (e) {
      // Even raw output failed, just continue
      if (this.verboseErrors) {
        console.error(`[${this.agentName}] Failed to output raw line:`, e);
      }
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
      // Safely handle various input types
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
        default:
          // Safely stringify unknown input
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
      
      // Handle assistant messages
      if (message.type === 'assistant' && message.message?.content) {
        this.processAssistantMessage(prefix, message.message.content);
      } 
      // Handle user messages (tool results)
      else if (message.type === 'user' && message.message?.content) {
        this.processUserMessage(prefix, message.message.content);
      }
      // Handle other message types gracefully
      else if (this.verboseErrors) {
        console.log(`${prefix} ${this.formatColor('[Unknown message type]', 'yellow')}`, message.type);
      }
    } catch (error) {
      this.handleError('processMessage', error, message);
    }
  }

  private processAssistantMessage(prefix: string, content: any[]) {
    try {
      if (!Array.isArray(content)) {
        if (this.verboseErrors) {
          console.error(`${prefix} Warning: content is not an array`);
        }
        return;
      }

      for (const item of content) {
        try {
          if (item.type === 'text' && item.text) {
            // Add spacing after tool results
            if (this.lastWasToolResult) {
              console.log();
              this.lastWasToolResult = false;
            }
            
            // Safely output text
            const safeText = String(item.text || '').substring(0, this.maxOutputLength);
            console.log(`${prefix} ${safeText}`);
          } else if (item.type === 'tool_use' && item.id) {
            const toolName = item.name || 'Unknown';
            const toolInfo = this.formatToolInput(toolName, item.input || {});
            console.log(`${prefix} ${this.formatColor('→', 'cyan')} ${this.formatColor(toolName, 'yellow')}: ${toolInfo}`);
            
            // Store tool info for matching with results
            this.pendingTools.set(item.id, {
              name: toolName,
              input: item.input,
              startTime: Date.now()
            });
          }
        } catch (itemError) {
          if (this.verboseErrors) {
            console.error(`${prefix} Error processing content item:`, itemError);
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
          console.error(`${prefix} Warning: content is not an array`);
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
              console.log(`${prefix} ${this.formatColor('✗', 'red')} Tool failed${timeStr}`);
              const errorPreview = this.truncateOutput(item.content, 2);
              if (errorPreview) {
                console.log(this.formatColor(`   ${errorPreview.replace(/\n/g, '\n   ')}`, 'red'));
              }
            } else {
              console.log(`${prefix} ${this.formatColor('✓', 'green')} Completed${timeStr}`);
              
              // Show abbreviated output for certain tools
              if (toolInfo && ['Bash', 'Grep'].includes(toolInfo.name) && item.content) {
                const preview = this.truncateOutput(item.content, 3);
                if (preview && preview.trim()) {
                  console.log(this.formatColor(`   ${preview.replace(/\n/g, '\n   ')}`, 'dim'));
                }
              }
            }
            
            this.lastWasToolResult = true;
            this.pendingTools.delete(item.tool_use_id);
          }
        } catch (itemError) {
          if (this.verboseErrors) {
            console.error(`${prefix} Error processing tool result:`, itemError);
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
      console.error(`[${this.agentName}] Error in ${context}:`, 
        error instanceof Error ? error.message : error);
      
      if (data) {
        console.error(`[${this.agentName}] Related data:`, 
          JSON.stringify(data).substring(0, 300));
      }
    }
    
    // Emit error event for monitoring
    this.emit('parser-error', { context, error, data });
  }

  // Public method to get statistics
  public getStatistics() {
    return {
      lines: this.lineCount,
      success: this.successCount,
      errors: this.errorCount,
      errorRate: this.lineCount > 0 ? (this.errorCount / this.lineCount) * 100 : 0,
      pendingTools: this.pendingTools.size
    };
  }
}

// CLI usage: node parser-improved.js [agent-name] [options]
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
Usage: node parser-improved.js [agent-name] [options]

Options:
  --verbose, -v     Show detailed error information
  --no-fallback     Disable fallback to raw output on parse errors
  --no-color        Disable colored output
  --help, -h        Show this help message

The parser reads JSON stream from stdin and outputs formatted messages to stdout.
`);
    process.exit(0);
  }
  
  const parser = new ImprovedClaudeStreamParser(options);
  
  // Handle process termination
  process.on('SIGINT', () => {
    const stats = parser.getStatistics();
    console.error(`\n[${agentName}] Interrupted. Statistics:`, stats);
    process.exit(0);
  });
  
  process.stdin.pipe(parser).pipe(process.stdout);
}

export { ImprovedClaudeStreamParser, ParserOptions };