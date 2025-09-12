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
      if [ "$PARSED_OUTPUT" = "true" ]; then
        # Use parser for clean output
        cat "$test_prompt" | node dist/src/manager-runner.js --testing --prompt-stdin 2>&1 | node dist/src/test-parser.js || true
      else
        # Raw output
        cat "$test_prompt" | node dist/src/manager-runner.js --testing --prompt-stdin 2>&1 || true
      fi
      ;;
      
    test-manager-calls-planner)
      echo "[EXEC] Running Manager to call Planner..."
      echo "[INFO] This test validates the Manager can spawn and communicate with a Planner agent"
      echo ""
      # Run manager with test prompt - it will use Bash tool to spawn planner
      if [ "$PARSED_OUTPUT" = "true" ]; then
        cat "$test_prompt" | node dist/src/manager-runner.js --testing --prompt-stdin 2>&1 | node dist/src/test-parser.js || true
      else
        cat "$test_prompt" | node dist/src/manager-runner.js --testing --prompt-stdin 2>&1 || true
      fi
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
    if grep -q "MANAGER HAIKU:" "$OUTPUT_FILE"; then
      # Count lines after "MANAGER HAIKU:" that are not empty
      HAIKU_LINES=$(sed -n '/MANAGER HAIKU:/,$ p' "$OUTPUT_FILE" | tail -n +2 | grep -v '^$' | head -3 | wc -l)
      if [ "$HAIKU_LINES" -eq 3 ]; then
        echo "✅ Manager generated a 3-line haiku"
        echo "📝 Haiku content:"
        sed -n '/MANAGER HAIKU:/,$ p' "$OUTPUT_FILE" | tail -n +2 | head -3 | sed 's/^/   /'
        RESULT=0
      else
        echo "❌ Manager response was not a proper 3-line haiku (found $HAIKU_LINES lines)"
        RESULT=1
      fi
    else
      echo "❌ Manager did not respond with 'MANAGER HAIKU:' header"
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
    
    if grep -q "node.*agent.js plan" "$OUTPUT_FILE"; then
      echo "✅ Spawn command executed (node .../agent.js plan)"
      ((CHECKS++))
    else
      echo "❌ No spawn command found"
    fi
    
    if grep -q "MANAGER: Received planner response:" "$OUTPUT_FILE"; then
      echo "✅ Manager received and reported Planner's response"
      # Extract and show the planner's haiku
      echo "📝 Planner's response:"
      sed -n '/MANAGER: Received planner response:/p' "$OUTPUT_FILE" | sed 's/MANAGER: Received planner response://' | sed 's/^/   /'
      ((CHECKS++))
    else
      echo "❌ Manager did not report receiving Planner response"
    fi
    
    if [ $CHECKS -eq 3 ]; then
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