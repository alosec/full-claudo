# Active Context

## Current Phase
✅ PARSER ARCHITECTURE SIMPLIFIED - Fixed output issues with host-based parsing

## Recent Work: Architecture Simplification Success

### Problem Resolution
**SOLVED**: Console.log stopping after ~3 seconds in Docker container by moving parser to host machine where console.log works reliably.

### The Journey to Simplicity
1. **Initial Problem**: Parser output stops after ~3 seconds, Claude keeps going
2. **Complex Solutions**: Multiple attempts with TTY detection, file output, heartbeats
3. **Final Solution**: Move parser to host machine where console.log works
   - **Result**: ✅ Simple, reliable, and maintainable

### Simplified Architecture
**New approach eliminates all complexity:**
- Manager outputs raw JSON to Docker logs (stdout works fine)
- Host-based parser reads `docker logs -f` and parses JSON stream
- Console.log works perfectly on host machine
- Single, simple implementation path

### Key Architectural Changes
- ✅ Removed `tty-detector.ts` and all TTY detection logic
- ✅ Simplified `up.ts` to always use detached mode with host parser
- ✅ Simplified `manager-runner.ts` to output raw JSON only
- ✅ Created `host-parser.ts` for reliable host-based parsing
- ✅ Updated `logs.ts` to use host-based parser for live output

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