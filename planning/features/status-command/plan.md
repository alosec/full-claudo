# Implementation Plan: Status Command

## Understanding
Need to add a `claudo status` command that provides users with visibility into the system state, including whether the manager is running, recent activity, and current tasks.

## File Changes
```
src/
├── [M] cli.ts - Add 'status' command to CLI routing and help text
├── [C] status.ts - New module implementing status functionality
└── [M] up.ts - Possibly reuse container detection logic

dist/ (auto-generated from TypeScript compilation)
├── [M] cli.js - Compiled CLI with new status command
└── [C] status.js - Compiled status functionality
```

## Implementation Notes
- Reuse container detection patterns from up.ts/down.ts
- Check for manager container by name 'claudo-manager'
- Read recent work-log entries (last 3-5 entries)
- Display planning/INDEX.md active tasks if available
- Handle cases where manager is not running
- Provide helpful next steps for users

## Dependencies
- No new dependencies required
- Uses existing Node.js child_process for container checks
- File system operations for reading logs and planning files