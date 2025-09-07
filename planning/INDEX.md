# Planning Index

## Overview
This is the master planning index for the Full Claudo multi-agent system. Tasks are organized hierarchically in the `tasks/` directory with nesting indicating specificity.

## Active Tasks
_Tasks currently being worked on or planned_

### High Priority
- [ ] `tasks/setup-planning-system/` - Initial planning system setup
  - [ ] Configure agent prompts for planning awareness
  - [ ] Establish work-log automation

### Medium Priority
_None currently_

### Low Priority
_None currently_

## Completed Tasks
_Tasks that have been successfully completed_

- [x] Initial Full Claudo architecture (2025-09-07)
- [x] Docker sandbox configuration (2025-09-07)
- [x] Agent prompt definitions (2025-09-07)

## Feature Plans
_Strategic feature planning documents_

- See `features/` directory for detailed feature plans

## Task Organization

Tasks follow a hierarchical structure:
```
tasks/
├── implement-auth/           # Parent task
│   ├── README.md             # Task overview and requirements
│   ├── sign-in-page/         # Specific subtask
│   │   ├── README.md         # Subtask details
│   │   └── notes.md          # Implementation notes
│   └── session-management/   # Another subtask
└── fix-bugs/
    └── bug-123/
        └── README.md
```

## Work Log
Completed work is automatically logged in `work-log/` with timestamps and details.

## Quick Links
- [Task Guidelines](tasks/README.md)
- [Feature Planning](features/README.md)
- [Work Log](../work-log/README.md)