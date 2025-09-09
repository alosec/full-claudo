# Agent Spawning Fix Implementation Plan

## Problem Analysis

The current agent spawning system has two critical path issues:

1. **claudo script path detection**: The script assumes `/usr/local/lib/claudo` in Docker when the actual location is `/workspace`
2. **agent.js prompt path**: The agent.js file hardcodes `/usr/local/lib/claudo/prompts/` when prompts are at `/workspace/prompts/`

## File Tree Changes

```
/workspace/
├── claudo                    # [MODIFY] Fix Docker path detection logic
├── dist/src/agent.js         # [MODIFY] Fix hardcoded prompt path
└── prompts/                  # [VERIFY] Ensure prompts exist
    ├── planner.md
    ├── worker.md
    ├── critic.md
    └── oracle.md
```

## Implementation Steps

### 1. Fix claudo Script (`/workspace/claudo`)

**Current problematic logic:**
```bash
if [[ -f "/.dockerenv" ]] && [[ -d "/usr/local/lib/claudo" ]]; then
  CLAUDO_LIB="/usr/local/lib/claudo"
```

**Fix:** Update to use `/workspace` when in Docker:
```bash
if [[ -f "/.dockerenv" ]]; then
  CLAUDO_LIB="/workspace"
```

**Additional changes:**
- Update dist path references to use `dist/src/` subdirectory
- Fix version check to use workspace package.json

### 2. Fix agent.js Prompt Path (`/workspace/dist/src/agent.js`)

**Current problematic line:**
```javascript
const basePrompt = readFileSync(`/usr/local/lib/claudo/prompts/${promptFile}.md`, 'utf8');
```

**Fix:** Use workspace-relative path:
```javascript
const basePrompt = readFileSync(`/workspace/prompts/${promptFile}.md`, 'utf8');
```

### 3. Verification Tests

After fixes, test all agent types:
- `claudo plan "Test planner"`
- `claudo worker "Test worker"`  
- `claudo critic "Test critic"`
- `claudo oracle "Test oracle"`

## Expected Outcome

- Manager can successfully spawn all agent types using `claudo [agent-type] "task"`
- Agents receive correct prompts and execute Claude CLI properly
- Full multi-agent orchestration enabled

## Risk Assessment

**Low Risk Changes:**
- Path fixes are straightforward string replacements
- No logic changes required
- Maintains all existing functionality

**Verification:**
- Test each agent type individually
- Verify prompts are read correctly
- Ensure Claude CLI spawning works as expected