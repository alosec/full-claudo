# Active Context

## Current Phase
⚠️ NEW ISSUE: Parser receiving debug messages mixed with JSON stream

## Latest Problem: Mixed Output Stream
The host-based parser is receiving both debug messages and JSON from `docker logs`:
```
[claudo] Starting Manager with streaming JSON bus...  <- NOT JSON
[claudo] DEBUG: Prompt file saved to...               <- NOT JSON
{"type":"assistant","message":{"content":[...]}}     <- ACTUAL JSON
```

This causes parse errors as the parser tries to parse debug messages as JSON.

## Escaping Issues - Recurring Theme
**Escaping problems have been a consistent challenge throughout this project:**
1. Shell escaping in prompts (backticks in markdown)
2. JSON escaping in tool parameters
3. Now: Mixed stdout streams (debug text + JSON)

## Current Architecture Status

### After Simplification Attempt
- ✅ Created `host-parser.ts` to run parser on host (where console.log works)
- ✅ Manager outputs to docker logs
- ❌ BUT: Docker logs contains both debug output AND JSON stream mixed together
- ❌ Parser can't distinguish between debug messages and actual JSON

### The Data Flow Problem
1. Manager process outputs debug messages to stdout/stderr
2. Claude CLI outputs JSON stream to stdout
3. Docker logs combines everything
4. Parser receives mixed stream and fails to parse debug lines

## Reliable Data Source
**`.claudo/manager-debug.jsonl` captures ONLY the JSON stream** - this file is clean and parseable.

## Potential Solutions

### Option 1: Read from Debug File (Most Reliable)
```javascript
// Instead of docker logs, read the clean JSON file
tail -f .claudo/manager-debug.jsonl | parser
```

### Option 2: Separate Debug Output
- Send debug messages to stderr only
- Keep stdout clean for JSON stream
- Docker logs can then filter: `docker logs claudo-manager 2>/dev/null`

### Option 3: Prefix Filtering
- Add unique prefix to JSON lines
- Filter in parser: only parse lines starting with prefix

## System Status
- ✅ **Manager Function**: Works correctly, processes tasks
- ✅ **Debug Log**: Captures clean JSON stream reliably
- ❌ **Live Output**: Mixed stream causes parse errors
- ❌ **Clean Display**: Users see error messages instead of parsed output

## Key Files
- `src/host-parser.ts` - Host-based parser reading docker logs
- `src/manager-runner.ts` - Outputs both debug and JSON to stdout
- `.claudo/manager-debug.jsonl` - Clean JSON stream (reliable)
- `docker logs claudo-manager` - Mixed output stream (problematic)

## The Pattern
Every layer we add seems to create new escaping/mixing problems:
- Shell → Markdown escaping
- Process → JSON escaping  
- Docker → Stream mixing

Perhaps the solution is fewer layers, not more parsing.