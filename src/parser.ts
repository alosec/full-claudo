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
  private lineCount: number = 0;
  private lastOutputTime: number = Date.now();
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(options: string | ParserOptions = 'Agent', useColors: boolean = true) {
    super({ 
      objectMode: true,
      highWaterMark: 16 // Prevent backpressure
    });
    
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
    
    // Set up stream error handlers
    this.on('error', (err) => {
      console.error(`[${this.agentName}] Stream error:`, err.message);
    });
    
    // Monitor stream health
    this.healthCheckInterval = setInterval(() => {
      const timeSinceLastOutput = Date.now() - this.lastOutputTime;
      if (timeSinceLastOutput > 10000) { // 10 seconds without output
        console.error(`[${this.agentName}] Warning: No output for ${Math.floor(timeSinceLastOutput / 1000)}s`);
        console.error(`[${this.agentName}] Lines processed: ${this.lineCount}, Buffer size: ${this.buffer.length}`);
      }
    }, 5000);
  }
  
  private output(text: string) {
    try {
      if (this.outputFile) {
        // Write to file instead of console
        appendFileSync(this.outputFile, text + '\n');
      } else {
        // Write to console with error handling
        if (process.stdout.writable) {
          console.log(text);
        } else {
          // Stdout not writable, try stderr as fallback
          console.error(`[${this.agentName}] STDOUT NOT WRITABLE, using stderr:`, text);
        }
      }
      this.lastOutputTime = Date.now();
    } catch (e) {
      // Catch any output errors
      console.error(`[${this.agentName}] Output error:`, e instanceof Error ? e.message : e);
    }
  }
  
  private outputError(text: string) {
    try {
      if (this.outputFile) {
        // Write errors to file too
        appendFileSync(this.outputFile, text + '\n');
      } else {
        if (process.stderr.writable) {
          console.error(text);
        } else {
          // Last resort: try to write somewhere
          process.stderr.write(text + '\n');
        }
      }
    } catch (e) {
      // Even error output failed - last resort
      process.stderr.write(`[CRITICAL] Output failed: ${e}\n`);
    }
  }

  _transform(chunk: any, encoding: string, callback: Function) {
    // Handle backpressure proactively
    const continueProcessing = () => {
      try {
        this.buffer += chunk.toString();
        
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          this.lineCount++;
          if (line.trim()) {
            try {
              const message: StreamMessage = JSON.parse(line);
              this.processMessage(message);
            } catch (e) {
              // Enhanced verbose JSON parsing errors for debugging
              this.outputError(`[${this.agentName}] JSON parse error at line ${this.lineCount}: ${e instanceof Error ? e.message : e}`);
              this.outputError(`[${this.agentName}] Problematic line (${line.length} chars): ${line.substring(0, 300)}`);
              this.outputError(`[${this.agentName}] Line starts with: "${line.substring(0, 50)}..."`);
              this.outputError(`[${this.agentName}] Line ends with: "...${line.substring(Math.max(0, line.length - 50))}"`);
              
              // Show character codes for debugging special characters
              const firstChars = line.substring(0, 20).split('').map(c => `${c}(${c.charCodeAt(0)})`).join('');
              this.outputError(`[${this.agentName}] First 20 chars with codes: ${firstChars}`);
              
              // Fallback: show raw content if it looks like meaningful output
              if (line.length > 10 && !line.startsWith('{')) {
                this.output(`[${this.agentName}] Raw: ${line}`);
              }
            }
          }
        }
        
        // Don't push anything downstream - we're outputting directly via console.log
        // Just call the callback to signal we're ready for more data
        callback();
      } catch (e) {
        // Enhanced verbose transform errors for debugging
        this.outputError(`[${this.agentName}] Transform error at line ${this.lineCount}: ${e instanceof Error ? e.message : e}`);
        this.outputError(`[${this.agentName}] Error stack: ${e instanceof Error ? e.stack : 'No stack trace'}`);
        this.outputError(`[${this.agentName}] Chunk (${chunk.toString().length} chars): ${chunk.toString().substring(0, 200)}`);
        this.outputError(`[${this.agentName}] Buffer state: ${this.buffer.length} chars buffered`);
        this.outputError(`[${this.agentName}] Pending tools: ${this.pendingTools.size}`);
        
        // Continue processing despite errors
        callback();
      }
    };
    
    // Use setImmediate to prevent stack overflow on large streams
    setImmediate(continueProcessing);
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
      // Verify we can still output before processing
      if (!process.stdout.writable && !this.outputFile) {
        console.error(`[${this.agentName}] WARNING: stdout not writable, message may be lost`);
      }
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
      // Enhanced verbose message processing errors
      this.outputError(`[${this.agentName}] Error processing message: ${e instanceof Error ? e.message : e}`);
      this.outputError(`[${this.agentName}] Error stack: ${e instanceof Error ? e.stack : 'No stack trace'}`);
      this.outputError(`[${this.agentName}] Message type: ${message?.type || 'unknown'}`);
      this.outputError(`[${this.agentName}] Message content length: ${message?.message?.content?.length || 0}`);
      this.outputError(`[${this.agentName}] Full message: ${JSON.stringify(message).substring(0, 500)}`);
    }
  }
}

// Cleanup helper for health check intervals
let globalHealthCheckInterval: NodeJS.Timeout | undefined;

// CLI usage: node parser.js [agent-name]
if (require.main === module) {
  const agentName = process.argv[2] || 'Agent';
  const parser = new ClaudeStreamParser(agentName);
  
  // Add error handling for stdin
  process.stdin.on('error', (err) => {
    console.error(`[${agentName}] stdin error:`, err.message);
  });
  
  // Parser outputs directly via console.log, no need to pipe to stdout
  process.stdin.pipe(parser);
}

export default ClaudeStreamParser;