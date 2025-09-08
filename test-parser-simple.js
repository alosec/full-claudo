#!/usr/bin/env node

// Simple test with proper line-by-line JSON
const { ImprovedClaudeStreamParser } = require('./dist/parser-improved');

const parser = new ImprovedClaudeStreamParser({
  agentName: 'Test',
  verboseErrors: true,
  fallbackToRaw: true,
  useColors: true
});

console.log('Testing single JSON objects...\n');

// Test 1: Valid assistant message
parser.write('{"type":"assistant","message":{"id":"msg_01","content":[{"type":"text","text":"Hello world!"}]}}\n');

// Test 2: Valid tool use
parser.write('{"type":"assistant","message":{"id":"msg_02","content":[{"type":"tool_use","id":"toolu_01","name":"Bash","input":{"command":"echo test"}}]}}\n');

// Test 3: Valid tool result
parser.write('{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"toolu_01","content":"test","is_error":false}]}}\n');

// Test 4: Malformed JSON
parser.write('{"type":"assistant","broken":\n');

setTimeout(() => {
  console.log('\n--- Statistics ---');
  console.log(parser.getStatistics());
}, 100);