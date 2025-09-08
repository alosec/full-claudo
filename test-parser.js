#!/usr/bin/env node

// Test the improved parser with sample JSON data
const { ImprovedClaudeStreamParser } = require('./dist/parser-improved');

// Sample JSON stream data that could cause parsing issues
const testData = [
  '{"type":"assistant","message":{"id":"msg_01","content":[{"type":"text","text":"Starting task..."}]}}',
  '{"type":"assistant","message":{"id":"msg_02","content":[{"type":"tool_use","id":"toolu_01","name":"Bash","input":{"command":"ls -la","description":"List files"}}]}}',
  '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"toolu_01","content":"total 8\\ndrwxr-xr-x 2 user user 4096 Sep  8 12:00 .\\n-rw-r--r-- 1 user user  123 Sep  8 12:00 test.txt","is_error":false}]}}',
  '{"type":"assistant","message":{"id":"msg_03","content":[{"type":"text","text":"Task completed successfully!"}]}}',
  // Intentionally malformed JSON to test error handling
  '{"type":"assistant","broken_json":',
  '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"toolu_02","content":"Error: file not found","is_error":true}]}}'
];

console.log('Testing ImprovedClaudeStreamParser...\n');

const parser = new ImprovedClaudeStreamParser({
  agentName: 'Test',
  verboseErrors: true,
  fallbackToRaw: true,
  useColors: true
});

// Test each JSON line
testData.forEach((line, index) => {
  console.log(`\n--- Test ${index + 1} ---`);
  // Simulate the stream by writing each line separately
  setTimeout(() => {
    parser.write(line + '\n');
  }, index * 50);
});

// Test final statistics
setTimeout(() => {
  const stats = parser.getStatistics();
  console.log('\n--- Final Statistics ---');
  console.log(stats);
  console.log('\nTest completed!');
}, 500);