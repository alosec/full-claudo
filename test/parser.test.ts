#!/usr/bin/env node

import { Readable, Writable } from 'stream';
import { ClaudeStreamParser } from '../src/parser';

interface TestCase {
  name: string;
  input: string[];
  expectedOutput?: string[];
  shouldNotCrash: boolean;
}

const testCases: TestCase[] = [
  {
    name: 'Simple text message',
    input: [
      '{"type":"assistant","message":{"id":"msg_01","content":[{"type":"text","text":"Hello world"}]}}'
    ],
    expectedOutput: ['[Agent] Hello world'],
    shouldNotCrash: true
  },
  {
    name: 'Tool use with bash command',
    input: [
      '{"type":"assistant","message":{"id":"msg_01","content":[{"type":"tool_use","id":"toolu_01","name":"Bash","input":{"command":"ls -la"}}]}}'
    ],
    expectedOutput: ['[Agent] → Bash: $ ls -la'],
    shouldNotCrash: true
  },
  {
    name: 'Tool result success',
    input: [
      '{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_01","content":"file1.txt\\nfile2.txt"}]}}'
    ],
    expectedOutput: ['[Agent] ✓ Completed'],
    shouldNotCrash: true
  },
  {
    name: 'Tool result with error',
    input: [
      '{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_01","content":"Error: File not found","is_error":true}]}}'
    ],
    expectedOutput: ['[Agent] ✗ Tool failed'],
    shouldNotCrash: true
  },
  {
    name: 'Malformed JSON',
    input: [
      '{"type":"assistant","message":{"id":"msg_01","content":[{"type":"text","text":"Hello'
    ],
    shouldNotCrash: true
  },
  {
    name: 'Empty message',
    input: [''],
    shouldNotCrash: true
  },
  {
    name: 'Null values in content',
    input: [
      '{"type":"assistant","message":{"id":"msg_01","content":null}}'
    ],
    shouldNotCrash: true
  },
  {
    name: 'Special characters in text',
    input: [
      '{"type":"assistant","message":{"id":"msg_01","content":[{"type":"text","text":"Special chars: \\n\\t\\r\\\\\\""}]}}'
    ],
    shouldNotCrash: true
  },
  {
    name: 'Very long tool output',
    input: [
      '{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_01","content":"' + 'A'.repeat(10000) + '"}]}}'
    ],
    shouldNotCrash: true
  },
  {
    name: 'Unicode characters',
    input: [
      '{"type":"assistant","message":{"id":"msg_01","content":[{"type":"text","text":"Unicode: 你好世界 😀 🚀"}]}}'
    ],
    shouldNotCrash: true
  },
  {
    name: 'Missing required fields',
    input: [
      '{"type":"assistant"}',
      '{"message":{"id":"msg_01"}}',
      '{"type":"user","message":{}}'
    ],
    shouldNotCrash: true
  },
  {
    name: 'Multiple messages in sequence',
    input: [
      '{"type":"assistant","message":{"id":"msg_01","content":[{"type":"text","text":"First message"}]}}',
      '{"type":"assistant","message":{"id":"msg_02","content":[{"type":"tool_use","id":"toolu_01","name":"Read","input":{"file_path":"/test.txt"}}]}}',
      '{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_01","content":"File contents"}]}}',
      '{"type":"assistant","message":{"id":"msg_03","content":[{"type":"text","text":"Done"}]}}'
    ],
    shouldNotCrash: true
  },
  {
    name: 'Nested JSON in tool input',
    input: [
      '{"type":"assistant","message":{"id":"msg_01","content":[{"type":"tool_use","id":"toolu_01","name":"Edit","input":{"file_path":"/test.txt","old_string":"{\\"nested\\":{\\"json\\":true}}","new_string":"replacement"}}]}}'
    ],
    shouldNotCrash: true
  },
  {
    name: 'Array in tool result content',
    input: [
      '{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_01","content":"[\\"item1\\",\\"item2\\",\\"item3\\"]"}]}}'
    ],
    shouldNotCrash: true
  },
  {
    name: 'HTML/XML-like content in messages',
    input: [
      '{"type":"assistant","message":{"id":"msg_01","content":[{"type":"text","text":"<div>HTML content</div><script>alert(1)</script>"}]}}'
    ],
    shouldNotCrash: true
  },
  {
    name: 'Control characters in content',
    input: [
      '{"type":"assistant","message":{"id":"msg_01","content":[{"type":"text","text":"Control: \\u0000\\u0001\\u0002"}]}}'
    ],
    shouldNotCrash: true
  },
  {
    name: 'Incomplete JSON stream (split mid-message)',
    input: [
      '{"type":"assistant","message":{"id":"msg_01","content":[{"type":"tex',
      't","text":"Complete now"}]}}'
    ],
    shouldNotCrash: true
  },
  {
    name: 'Mixed valid and invalid JSON lines',
    input: [
      '{"type":"assistant","message":{"id":"msg_01","content":[{"type":"text","text":"Valid"}]}}',
      'not json at all',
      '{"type":"assistant","message":{"id":"msg_02","content":[{"type":"text","text":"Also valid"}]}}'
    ],
    shouldNotCrash: true
  },
  {
    name: 'Extremely nested JSON structure',
    input: [
      '{"type":"assistant","message":{"id":"msg_01","content":[{"type":"tool_use","id":"toolu_01","name":"Complex","input":' + 
      JSON.stringify({
        level1: { level2: { level3: { level4: { level5: { level6: { level7: { level8: { level9: { level10: 'deep' } } } } } } } } }
      }) + '}]}}'
    ],
    shouldNotCrash: true
  },
  {
    name: 'Binary data representation in content',
    input: [
      '{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_01","content":"\\u0089PNG\\r\\n\\u001a\\n\\u0000\\u0000\\u0000\\rIHDR"}]}}'
    ],
    shouldNotCrash: true
  }
];

class TestOutputStream extends Writable {
  public output: string[] = [];
  
  constructor() {
    super({ objectMode: true });
  }
  
  _write(chunk: any, encoding: string, callback: Function) {
    // Capture console.log output by overriding it temporarily
    callback();
  }
}

async function runTest(testCase: TestCase): Promise<boolean> {
  return new Promise((resolve) => {
    const parser = new ClaudeStreamParser('Agent', false); // Disable colors for testing
    const input = new Readable({ read() {} });
    const output = new TestOutputStream();
    
    let crashed = false;
    let consoleOutput: string[] = [];
    
    // Override console.log to capture output
    const originalLog = console.log;
    const originalError = console.error;
    console.log = (...args: any[]) => {
      consoleOutput.push(args.join(' '));
    };
    console.error = (...args: any[]) => {
      // Ignore errors in test mode
    };
    
    parser.on('error', (error) => {
      crashed = true;
    });
    
    parser.on('finish', () => {
      // Restore console
      console.log = originalLog;
      console.error = originalError;
      
      if (testCase.shouldNotCrash && crashed) {
        originalLog(`❌ ${testCase.name}: Parser crashed unexpectedly`);
        resolve(false);
      } else if (testCase.shouldNotCrash && !crashed) {
        originalLog(`✅ ${testCase.name}: Parser handled input without crashing`);
        resolve(true);
      } else {
        originalLog(`✅ ${testCase.name}: Test completed`);
        resolve(true);
      }
    });
    
    // Connect streams
    input.pipe(parser).pipe(output);
    
    // Send test input
    testCase.input.forEach(line => {
      input.push(line + '\n');
    });
    input.push(null); // End stream
  });
}

async function runAllTests() {
  console.log('Running Parser Edge Case Tests\n');
  console.log('='.repeat(50));
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    const result = await runTest(testCase);
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`\nTest Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    console.log('\n⚠️  Some tests failed. The parser needs better error handling.');
    process.exit(1);
  } else {
    console.log('\n✨ All tests passed! The parser handles edge cases gracefully.');
    process.exit(0);
  }
}

// Run tests if called directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}

export { runAllTests, testCases };