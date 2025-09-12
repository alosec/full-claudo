#!/usr/bin/env node

import { Transform } from 'stream';

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

/**
 * Test-specific parser that processes Claude JSON streams for clean test output
 * - Shows only assistant text messages and successful tool results
 * - No colors, prefixes, or formatting for easy grep verification
 * - Maintains compatibility with existing test verification patterns
 */
export class TestParser extends Transform {
  private buffer: string = '';

  constructor() {
    super({ objectMode: true });
  }

  _transform(chunk: any, encoding: string, callback: Function) {
    try {
      this.buffer += chunk.toString();
      
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const message: StreamMessage = JSON.parse(line);
            this.processMessage(message);
          } catch (e) {
            // Skip malformed JSON in test mode
          }
        }
      }
      
      callback();
    } catch (e) {
      callback();
    }
  }

  private processMessage(message: StreamMessage) {
    if (message.type === 'assistant' && message.message?.content) {
      // Only show text content from assistant messages
      for (const content of message.message.content) {
        if (content.type === 'text' && content.text) {
          const text = content.text.trim();
          if (text) {
            console.log(text);
          }
        }
      }
    } else if (message.type === 'user' && message.message?.content) {
      // Show successful tool results (for commands that produce expected output)
      for (const content of message.message.content) {
        if (content.type === 'tool_result' && !content.is_error && content.content) {
          const result = content.content.trim();
          if (result) {
            console.log(result);
          }
        }
      }
    }
  }
}

// CLI usage
if (require.main === module) {
  const parser = new TestParser();
  process.stdin.pipe(parser);
}

export default TestParser;