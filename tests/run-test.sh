#!/bin/bash

# Full Claudo Test Runner
# Simple, observable tests for the multi-agent system

set -e

TESTING_MODE=true
TEST_NAME="${1:-test-manager-hello}"

echo "═══════════════════════════════════════════════════════════════"
echo "FULL CLAUDO TEST RUNNER"
echo "Test: $TEST_NAME"
echo "Time: $(date -Iseconds)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Build the project first
echo "[BUILD] Running npm build..."
npm run build >/dev/null 2>&1 || {
  echo "❌ Build failed"
  exit 1
}
echo "✅ Build successful"
echo ""

# Function to run a test
run_test() {
  local test_name=$1
  local test_prompt="tests/prompts/${test_name}.md"
  
  if [ ! -f "$test_prompt" ]; then
    echo "❌ Test prompt not found: $test_prompt"
    exit 1
  fi
  
  echo "[TEST] Running: $test_name"
  echo "[TEST] Prompt: $test_prompt"
  echo ""
  echo "─────────────────────────────────────────────────────────────"
  echo "OUTPUT START"
  echo "─────────────────────────────────────────────────────────────"
  
  case "$test_name" in
    test-manager-hello)
      echo "[EXEC] Running Manager with hello world prompt..."
      echo ""
      # Run manager directly with test prompt
      cat "$test_prompt" | node dist/src/manager-runner.js --testing --prompt-stdin 2>&1 || true
      ;;
      
    test-manager-calls-planner)
      echo "[EXEC] Running Manager to call Planner..."
      echo ""
      # First ensure planner test mode is ready
      export PLANNER_TEST_MODE=true
      cat "$test_prompt" | node dist/src/manager-runner.js --testing --prompt-stdin 2>&1 || true
      ;;
      
    test-planner-direct)
      echo "[EXEC] Running Planner directly..."
      echo ""
      # Test planner directly
      node dist/src/agent.js plan --testing --prompt-file "$test_prompt" "TEST: Respond with 'PLANNER: Direct test successful'" 2>&1 || true
      ;;
      
    *)
      echo "❌ Unknown test: $test_name"
      exit 1
      ;;
  esac
  
  echo ""
  echo "─────────────────────────────────────────────────────────────"
  echo "OUTPUT END"
  echo "─────────────────────────────────────────────────────────────"
  echo ""
}

# Run the test and capture output
OUTPUT_FILE="/tmp/claudo-test-${TEST_NAME}-$$.log"
run_test "$TEST_NAME" | tee "$OUTPUT_FILE"

# Check results
echo "═══════════════════════════════════════════════════════════════"
echo "TEST VERIFICATION"
echo "═══════════════════════════════════════════════════════════════"

case "$TEST_NAME" in
  test-manager-hello)
    if grep -q "MANAGER: Hello World - I am operational" "$OUTPUT_FILE"; then
      echo "✅ Manager responded correctly"
      RESULT=0
    else
      echo "❌ Manager did not respond with expected message"
      RESULT=1
    fi
    ;;
    
  test-manager-calls-planner)
    CHECKS=0
    if grep -q "MANAGER: Starting planner test" "$OUTPUT_FILE"; then
      echo "✅ Manager started test"
      ((CHECKS++))
    else
      echo "❌ Manager did not start properly"
    fi
    
    if grep -q "agent.js" "$OUTPUT_FILE"; then
      echo "✅ Spawn command detected"
      ((CHECKS++))
    else
      echo "❌ No spawn command found"
    fi
    
    if grep -q "PLANNER: Hello from Planner" "$OUTPUT_FILE"; then
      echo "✅ Planner responded"
      ((CHECKS++))
    else
      echo "❌ No planner response detected"
    fi
    
    if grep -q "MANAGER: Received response from Planner" "$OUTPUT_FILE"; then
      echo "✅ Manager confirmed receipt"
      ((CHECKS++))
    else
      echo "❌ Manager did not confirm"
    fi
    
    if [ $CHECKS -eq 4 ]; then
      RESULT=0
    else
      RESULT=1
    fi
    ;;
    
  test-planner-direct)
    if grep -q "PLANNER: Direct test successful" "$OUTPUT_FILE"; then
      echo "✅ Planner responded correctly to direct test"
      RESULT=0
    else
      echo "❌ Planner did not respond correctly"
      RESULT=1
    fi
    ;;
    
  *)
    echo "❌ No verification for test: $TEST_NAME"
    RESULT=1
    ;;
esac

echo ""
echo "─────────────────────────────────────────────────────────────"
if [ $RESULT -eq 0 ]; then
  echo "OVERALL: ✅ PASSED"
else
  echo "OVERALL: ❌ FAILED"
  echo ""
  echo "Debug: Output saved to $OUTPUT_FILE"
fi
echo "═══════════════════════════════════════════════════════════════"

# Clean up
rm -f "$OUTPUT_FILE"

exit $RESULT