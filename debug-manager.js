#!/usr/bin/env node

const { detectContext, resolvePromptPath } = require('./dist/src/execution-context');

console.log('DEBUG: Starting manager-runner debug');
console.log('DEBUG: CWD:', process.cwd());
console.log('DEBUG: Detected context:', detectContext());
console.log('DEBUG: Resolved manager.md path:', resolvePromptPath('manager.md'));

// Now run the actual manager-runner
require('./dist/src/manager-runner');