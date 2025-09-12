#!/bin/bash

# Full Claudo Docker Test Suite
# Tests Manager running in Docker and spawning agents

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "FULL CLAUDO DOCKER TEST SUITE"
echo "Time: $(date -Iseconds)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Test 1: Manager runs in Docker with print mode
test_manager_docker() {
  echo "[TEST 1] Manager in Docker with -p flag"
  echo "─────────────────────────────────────────────────────────────"
  
  # Create a simple test prompt
  cat > .claudo/test-prompt.txt << 'EOF'
Write a haiku about Docker containers.
Format as three lines.
Start with "DOCKER HAIKU:" then the haiku.
EOF
  
  echo "[INFO] Starting Manager in Docker with print mode..."
  
  # Run Manager in Docker with -p flag for single response
  OUTPUT=$(cat .claudo/test-prompt.txt | claudo up -p 2>&1 || true)
  
  echo "$OUTPUT"
  
  # Verify we got a haiku
  if echo "$OUTPUT" | grep -q "DOCKER HAIKU:"; then
    echo ""
    echo "✅ TEST 1 PASSED: Manager responded from Docker"
    return 0
  else
    echo ""
    echo "❌ TEST 1 FAILED: No Docker haiku response"
    return 1
  fi
}

# Test 2: Manager in Docker spawns Planner agent
test_manager_spawns_planner() {
  echo ""
  echo "[TEST 2] Manager in Docker spawns Planner agent"
  echo "─────────────────────────────────────────────────────────────"
  
  # Create test prompt that instructs Manager to spawn Planner
  cat > .claudo/test-spawn.txt << 'EOF'
Your task:
1. Say "MANAGER: Starting agent spawn test"
2. Use the Bash tool to run this exact command:
   node /workspace/dist/src/agent.js plan --print "Write a haiku about planning" 2>&1
3. Capture the output from the command
4. Say "MANAGER: Received response from Planner"
5. Include the actual haiku you received
EOF
  
  echo "[INFO] Starting Manager in Docker to spawn Planner..."
  
  # Run Manager in Docker with -p flag
  OUTPUT=$(cat .claudo/test-spawn.txt | claudo up -p 2>&1 || true)
  
  echo "$OUTPUT"
  
  # Check for both Manager and Planner responses
  CHECKS=0
  
  if echo "$OUTPUT" | grep -q "MANAGER: Starting agent spawn test"; then
    echo "✅ Manager started test"
    ((CHECKS++))
  else
    echo "❌ Manager didn't start properly"
  fi
  
  if echo "$OUTPUT" | grep -q "node.*agent.js plan"; then
    echo "✅ Spawn command executed"
    ((CHECKS++))
  else
    echo "❌ No spawn command found"
  fi
  
  if echo "$OUTPUT" | grep -q "MANAGER: Received response from Planner"; then
    echo "✅ Manager confirmed receiving Planner response"
    ((CHECKS++))
  else
    echo "❌ Manager didn't confirm response"
  fi
  
  echo ""
  if [ $CHECKS -eq 3 ]; then
    echo "✅ TEST 2 PASSED: Manager successfully spawned Planner in Docker"
    return 0
  else
    echo "❌ TEST 2 FAILED: Only $CHECKS/3 checks passed"
    return 1
  fi
}

# Main test execution
main() {
  TEST_NAME="${1:-all}"
  # Ensure Docker is available
  if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first."
    exit 1
  fi
  
  # Ensure image is built
  if ! docker image inspect claudo-container &> /dev/null; then
    echo "[INFO] Building Docker image first..."
    claudo build
  fi
  
  # Stop any existing container
  claudo down 2>/dev/null || true
  
  # Run tests
  FAILED=0
  
  case "$TEST_NAME" in
    test_manager_docker)
      test_manager_docker || ((FAILED++))
      ;;
    test_manager_spawns_planner)
      test_manager_spawns_planner || ((FAILED++))
      ;;
    all|"")
      test_manager_docker || ((FAILED++))
      test_manager_spawns_planner || ((FAILED++))
      ;;
    *)
      echo "Unknown test: $TEST_NAME"
      echo "Available tests: test_manager_docker, test_manager_spawns_planner"
      exit 1
      ;;
  esac
  
  # Summary
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  if [ $FAILED -eq 0 ]; then
    echo "OVERALL: ✅ ALL TESTS PASSED"
  else
    echo "OVERALL: ❌ $FAILED TEST(S) FAILED"
  fi
  echo "═══════════════════════════════════════════════════════════════"
  
  # Cleanup
  claudo down 2>/dev/null || true
  
  exit $FAILED
}

main "$@"