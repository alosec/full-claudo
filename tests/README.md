# Full Claudo Testing Framework

Simple, observable tests to verify the multi-agent system actually works.

## Philosophy

The main problem with Full Claudo has been **observability** - we can't tell what's actually happening when agents spawn other agents. This testing framework provides:

1. **Simple test scenarios** - Each test does ONE thing
2. **Observable output** - You see exactly what each component outputs
3. **Clear verification** - Each test checks for specific expected outputs
4. **No magic** - Simple bash scripts and clear prompts

## Available Tests

### 1. Manager Hello World
```bash
npm run test:manager
```
- Tests: Can the Manager start and respond?
- Expected: "MANAGER: Hello World - I am operational"
- Purpose: Verify basic Manager functionality

### 2. Manager Calls Planner
```bash
npm run test:manager-calls-planner
```
- Tests: Can the Manager successfully spawn a Planner?
- Expected: 
  - Manager says "Starting planner test"
  - Spawn command is executed
  - Planner responds "Hello from Planner"
  - Manager confirms receipt
- Purpose: Verify agent spawning mechanism

### 3. Planner Direct Test
```bash
npm run test:planner-direct
```
- Tests: Can we call the Planner directly?
- Expected: "PLANNER: Direct test successful"
- Purpose: Verify Planner works in isolation

## How It Works

1. **Test Prompts** (`tests/prompts/`)
   - Simple markdown files with specific instructions
   - Each prompt tells the agent exactly what to output
   - No complex logic - just "respond with X"

2. **Test Runner** (`tests/run-test.sh`)
   - Builds the project
   - Runs the appropriate component with test prompt
   - Captures all output
   - Verifies expected responses

3. **Environment Variables**
   - `TESTING_MODE=true` - Enables test mode
   - Components can check this to behave differently in tests

## Adding New Tests

1. Create a prompt file:
```markdown
# tests/prompts/test-worker-hello.md
Respond with exactly: "WORKER: Hello from Worker"
```

2. Add test case to `run-test.sh`:
```bash
test-worker-hello)
  node dist/src/agent.js work --testing --prompt-file "$test_prompt" "test task"
  ;;
```

3. Add verification:
```bash
if grep -q "WORKER: Hello from Worker" "$OUTPUT_FILE"; then
  echo "✅ Worker responded correctly"
fi
```

4. Add npm script:
```json
"test:worker": "./tests/run-test.sh test-worker-hello"
```

## Debugging Failed Tests

When a test fails, the output shows:
- Exactly what command was run
- Full output from the component
- Which verification checks passed/failed
- Path to saved output for debugging

## The Key Insight

The main friction point appears to be **Manager spawning subagents**. These tests help isolate:
- Does the Manager work? (test:manager)
- Can the Manager spawn agents? (test:manager-calls-planner)
- Do agents work when called directly? (test:planner-direct)

This helps identify WHERE the system breaks down.

## Current Status

- ✅ Test framework created
- ✅ Basic test scenarios defined
- ⚠️  Tests may fail - that's the point! Now we can see WHY
- 🔍 Use test results to debug the actual issues

## Next Steps

1. Run the tests to see what actually works
2. Fix the broken parts (likely in spawn mechanism)
3. Add more granular tests as needed
4. Consider adding logging mode to track agent communication