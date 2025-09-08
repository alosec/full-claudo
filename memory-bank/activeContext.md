# Active Context

## Current Phase
🔧 PARSER OUTPUT ISSUES - Fighting Docker/Node.js stdout behavior

## Recent Work: Streaming Parser Complexity Spiral

### The Core Problem
Console.log mysteriously stops working after ~3 seconds when running parser in Docker container, even though Claude continues producing JSON output.

### Our Journey of Increasing Complexity
1. **Initial Problem**: Parser output stops after ~3 seconds, Claude keeps going
2. **First Attempt**: Created complex "bulletproof" parser with:
   - Direct file descriptor writes
   - Heartbeat monitoring
   - Multiple fallback mechanisms
   - Result: Still failed
3. **Second Attempt**: Tried Docker interactive mode (`-it`) for proper TTY
   - Result: Doesn't work in non-TTY environments like Claude Code
4. **Current Approach**: TTY detection with dual strategies
   - Interactive mode in real terminals
   - Detached mode with file output elsewhere
   - Result: Partially working but increasingly complex

### Where We've Ended Up
From a simple streaming parser to:
- Multiple parser versions (parser.ts, parser-v2.ts, parser-improved.ts)
- TTY detection utilities
- Dual output modes (console vs file)
- Different Docker strategies based on environment
- Multiple fallback mechanisms
- File-based output alternatives

### The Bigger Picture
**We're fighting the architecture rather than working with it.** Each "fix" introduces new edge cases and complexity.

## Current Status
- ✅ **TTY Detection**: Works correctly
- ✅ **Detached Mode**: Container runs without --rm, logs retrievable
- ⚠️ **Parser Output**: Works initially but console.log fails after seconds
- ⚠️ **Logs Command**: Sometimes hangs when following detached containers
- ✅ **Manager Function**: Actually completes tasks despite output issues

## Architecture Notes

### What's Actually Working
- Manager reads memory bank and planning files successfully
- Claude processes tasks and uses tools correctly
- Debug logs capture all activity (`.claudo/manager-debug.jsonl`)
- Container lifecycle management works

### What's Not Working
- Console output from parser inside Docker container
- Real-time visibility into what Claude is doing
- Clean streaming of parsed JSON to terminal

## Potential Simpler Solutions
1. **Run parser outside Docker**: Parse on host, not in container
2. **Use docker logs directly**: Skip custom parsing, use Docker's output
3. **File-based approach**: Write to files, tail them from host
4. **Different runtime**: Maybe Docker isn't the right tool here

## Previous Context (Still Valid)

### System Architecture
- **Entry Point**: `claudo` command (npm global link)
- **Manager**: Runs in Docker container `claudo-manager`
- **Parser**: Attempts to parse Claude's JSON stream
- **Communication**: File-based prompts, JSON streaming

### Key Files
- `src/parser.ts` - Main parser (simplified version)
- `src/utils/tty-detector.ts` - Environment detection
- `src/manager-runner.ts` - Runs manager with parser
- `src/up.ts` - Starts manager container
- `src/logs.ts` - Shows container output

### Debug Resources
- `.claudo/manager-debug.jsonl` - Raw JSON from Claude
- `.claudo/manager-output.log` - Parser output (when using file mode)
- `docker logs claudo-manager` - Container stdout/stderr

## Next Steps to Consider

1. **Step Back**: Re-evaluate if Docker is necessary for the manager
2. **Simplify**: Consider running parser on host, not in container
3. **Alternative**: Use existing tools (jq, docker logs) instead of custom parser
4. **Focus**: What's the actual goal - pretty output or working system?

## Key Learning
The system actually works - Claude completes tasks successfully. The only issue is visibility/output. We might be over-engineering the solution to a display problem.