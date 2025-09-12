#!/usr/bin/env node

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const TESTING_MODE = process.env.TESTING_MODE === 'true';
const TEST_NAME = process.argv[2];

if (!TESTING_MODE) {
  console.error('ERROR: TESTING_MODE must be set to true');
  process.exit(1);
}

if (!TEST_NAME) {
  console.error('ERROR: Test name required');
  console.error('Usage: npm run test:manager');
  console.error('       npm run test:manager-calls-planner');
  process.exit(1);
}

console.log('═══════════════════════════════════════════════════════════════');
console.log(`FULL CLAUDO TEST RUNNER`);
console.log(`Test: ${TEST_NAME}`);
console.log(`Time: ${new Date().toISOString()}`);
console.log('═══════════════════════════════════════════════════════════════\n');

async function runTest(testName: string) {
  const testPromptPath = path.join(__dirname, '..', 'tests', 'prompts', `${testName}.md`);
  
  if (!fs.existsSync(testPromptPath)) {
    console.error(`ERROR: Test prompt not found: ${testPromptPath}`);
    process.exit(1);
  }

  console.log(`[TEST] Loading prompt: ${testPromptPath}`);
  const promptContent = fs.readFileSync(testPromptPath, 'utf-8');
  
  console.log(`[TEST] Starting test execution...\n`);
  console.log('─────────────────────────────────────────────────────────────');
  console.log('OUTPUT START');
  console.log('─────────────────────────────────────────────────────────────\n');

  // Determine which component to run based on test name
  let command: string;
  let args: string[] = [];
  
  if (testName.startsWith('test-manager')) {
    // Run manager with test prompt
    command = 'node';
    args = [
      path.join(__dirname, '..', 'dist', 'src', 'manager-runner.js'),
      '--prompt-file', testPromptPath,
      '--testing-mode'
    ];
  } else if (testName.startsWith('test-planner')) {
    // Run planner directly
    command = 'node';
    args = [
      path.join(__dirname, '..', 'dist', 'src', 'agent.js'),
      'plan',
      '--prompt-file', testPromptPath,
      '--testing-mode',
      process.argv[3] || 'TEST: Default test task'
    ];
  } else {
    console.error(`ERROR: Unknown test type: ${testName}`);
    process.exit(1);
  }

  return new Promise((resolve, reject) => {
    console.log(`[TEST] Executing: ${command} ${args.join(' ')}\n`);
    
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        TESTING_MODE: 'true',
        TEST_NAME: testName
      }
    });

    // Pipe the prompt content to stdin
    child.stdin.write(promptContent);
    child.stdin.end();

    // Capture output
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      process.stdout.write(output);
    });

    child.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      process.stderr.write(`[STDERR] ${output}`);
    });

    child.on('close', (code) => {
      console.log('\n─────────────────────────────────────────────────────────────');
      console.log('OUTPUT END');
      console.log('─────────────────────────────────────────────────────────────\n');
      
      console.log(`[TEST] Process exited with code: ${code}`);
      
      // Check for expected outputs
      const checks = performChecks(testName, stdout, stderr);
      
      console.log('\n═══════════════════════════════════════════════════════════════');
      console.log('TEST RESULTS');
      console.log('═══════════════════════════════════════════════════════════════');
      
      checks.forEach(check => {
        const status = check.passed ? '✅' : '❌';
        console.log(`${status} ${check.name}: ${check.message}`);
      });
      
      const allPassed = checks.every(c => c.passed);
      console.log('\n─────────────────────────────────────────────────────────────');
      console.log(`OVERALL: ${allPassed ? '✅ PASSED' : '❌ FAILED'}`);
      console.log('═══════════════════════════════════════════════════════════════\n');
      
      resolve(allPassed ? 0 : 1);
    });

    child.on('error', (error) => {
      console.error(`[TEST] Process error: ${error.message}`);
      reject(error);
    });
  });
}

function performChecks(testName: string, stdout: string, stderr: string): Array<{name: string, passed: boolean, message: string}> {
  const checks = [];
  
  switch(testName) {
    case 'test-manager-hello':
      checks.push({
        name: 'Manager Response',
        passed: stdout.includes('MANAGER: Hello World - I am operational'),
        message: stdout.includes('MANAGER: Hello World') ? 'Manager responded correctly' : 'Manager did not respond with expected message'
      });
      break;
      
    case 'test-manager-calls-planner':
      checks.push({
        name: 'Manager Start',
        passed: stdout.includes('MANAGER: Starting planner test'),
        message: stdout.includes('MANAGER: Starting') ? 'Manager started test' : 'Manager did not start properly'
      });
      checks.push({
        name: 'Planner Spawn',
        passed: stdout.includes('node') && stdout.includes('agent.js'),
        message: stdout.includes('agent.js') ? 'Spawn command executed' : 'No spawn command found'
      });
      checks.push({
        name: 'Planner Response',
        passed: stdout.includes('PLANNER: Hello from Planner'),
        message: stdout.includes('PLANNER: Hello') ? 'Planner responded' : 'No planner response detected'
      });
      checks.push({
        name: 'Manager Confirmation',
        passed: stdout.includes('MANAGER: Received response from Planner'),
        message: stdout.includes('Received response') ? 'Manager confirmed receipt' : 'Manager did not confirm'
      });
      break;
      
    default:
      checks.push({
        name: 'Unknown Test',
        passed: false,
        message: `No checks defined for test: ${testName}`
      });
  }
  
  return checks;
}

// Run the test
runTest(TEST_NAME)
  .then(code => process.exit(code as number))
  .catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });