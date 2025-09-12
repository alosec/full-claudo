const { detectContext, resolvePromptPath } = require('./dist/src/execution-context');

console.log('Current working directory:', process.cwd());
console.log('Detected context:', detectContext());
console.log('Resolved prompt path:', resolvePromptPath('manager.md'));
console.log('Checking /.dockerenv:', require('fs').existsSync('/.dockerenv'));
console.log('Checking /workspace:', require('fs').existsSync('/workspace'));