# Work Log Documentation

## Overview

This directory contains automated work logs generated when tasks are completed. Each log entry captures what was done, when, and by which agent.

## File Naming Convention

```
YYYY-MM-DD-HHMM-brief-description.md
```

Examples:
- `2025-09-07-1000-implement-auth.md`
- `2025-09-07-1430-fix-login-bug.md`
- `2025-09-07-1645-refactor-parser.md`

## Work Log Format

Each work log file follows this structure:

```markdown
# Work Log: [Date Time] - [Task Description]

## Task Reference
- Planning Task: `planning/tasks/[task-directory]/`
- Status: Completed
- Agent: [Manager|Planner|Worker|Critic|Oracle]

## Summary
Brief description of what was accomplished

## Tasks Completed
- [ ] Specific subtask 1
- [ ] Specific subtask 2
- [ ] Specific subtask 3

## Files Modified
### Created
- `path/to/new/file.ts` - Description

### Modified
- `path/to/modified/file.ts` - What changed

### Deleted
- `path/to/deleted/file.ts` - Why removed

## Technical Notes
- Implementation approach taken
- Key decisions made
- Challenges overcome
- Performance considerations

## Testing
- Tests run: [command]
- Results: [passed/failed]
- Coverage: X%

## Follow-up Tasks
- Any new tasks identified
- Technical debt noted
- Future improvements suggested

## Time Spent
- Planning: X minutes
- Implementation: Y minutes
- Testing: Z minutes
- Total: N minutes

## Commit Reference
- Commit: [git hash]
- Message: "feat: [commit message]"
```

## Automation

Work logs are automatically created by:
1. **Manager Agent**: When marking tasks complete
2. **Worker Agent**: After successful implementation
3. **Manual**: Via `claudo log` command

## Best Practices

1. **Be Specific**: Include concrete details about changes
2. **Reference Tasks**: Always link to planning/tasks/ directory
3. **Document Decisions**: Explain why certain approaches were taken
4. **Track Time**: Helps with future estimation
5. **Include Commits**: Reference git commits for traceability

## Archive Policy

- Keep recent logs (< 30 days) in root directory
- Archive older logs to `archive/YYYY-MM/` subdirectories
- Maintain index file for quick searching