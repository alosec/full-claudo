# Task Organization Guidelines

## Directory Structure

Tasks are organized hierarchically with directories representing tasks and subtasks:

```
tasks/
├── [parent-task]/
│   ├── README.md              # Task overview, requirements, acceptance criteria
│   ├── [subtask-1]/
│   │   ├── README.md          # Subtask specific details
│   │   ├── notes.md           # Implementation notes, discoveries
│   │   └── plan.yaml          # Detailed implementation plan (if needed)
│   └── [subtask-2]/
│       └── README.md
└── [another-task]/
    └── README.md
```

## Task README Format

Each task directory should have a `README.md` with:

```markdown
# Task: [Task Name]

## Status
- [ ] Not Started / In Progress / Completed
- Created: YYYY-MM-DD
- Last Updated: YYYY-MM-DD

## Description
Brief description of what this task accomplishes

## Requirements
- Requirement 1
- Requirement 2

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Dependencies
- List any task dependencies
- Required features or configurations

## Implementation Notes
- Key decisions made
- Approach taken
- Blockers encountered

## Files Modified
- List of files created/modified/deleted
```

## Naming Conventions

1. **Directory names**: Use kebab-case (e.g., `implement-auth`, `fix-login-bug`)
2. **Be specific**: Names should clearly indicate the task purpose
3. **Nest by specificity**: More specific tasks go deeper in hierarchy

## Task Lifecycle

1. **Creation**: Manager or Planner creates task directory with README
2. **Planning**: Planner adds detailed plan.yaml if needed
3. **Implementation**: Worker executes, updates notes.md
4. **Review**: Critic validates, updates README with findings
5. **Completion**: Manager marks complete in INDEX.md, creates work-log entry

## Best Practices

- Keep task directories focused on single objectives
- Document decisions and blockers in notes.md
- Update INDEX.md when tasks change status
- Create work-log entries for completed tasks
- Archive old completed tasks periodically