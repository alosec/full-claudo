# Rename Done Directory to Docs - Implementation Plan

## Overview
Rename the `planning/done/` directory to `planning/docs/` to better represent that this is where completed features and tasks are documented as the final step from English requirements to working code.

## Current State Analysis
- `planning/done/` directory exists with completed task documentation
- Contains files like:
  - `2025-09-08-fix-parser-types.md`
  - `2025-09-08-fix-phantom-logging.md` 
  - `2025-09-08-fix-status-blank-output.md`
  - `2025-09-08-status-command.md`
  - `2025-09-08-test-workflow.md`
  - `README.md`
  - Subdirectory: `2025-09-08-fix-parser-types/`

## Implementation Steps

### 1. Directory Rename
- Rename `planning/done/` to `planning/docs/`
- Preserve all existing files and subdirectories

### 2. Update References
- Search for references to `planning/done/` in codebase
- Update any documentation that mentions the `done` directory
- Check for hardcoded paths in TypeScript/JavaScript files

### 3. Update Planning Documentation
- Update `planning/INDEX.md` to reference `docs/` instead of `done/`
- Update any README files that reference the old directory name
- Update manager agent instructions if they reference the `done` directory

### 4. Update Agent Prompts
- Check agent prompt files for references to `done` directory
- Update Manager prompt to use `docs` instead of `done` for completed work
- Update any other agent prompts that reference the directory structure

### 5. Validation
- Verify all files were moved correctly
- Test that the system still functions with the new directory name
- Ensure no broken references remain

## Files Likely to Need Updates
- `planning/INDEX.md` - Contains references to directory structure
- `memory-bank/progress.md` - May contain references to done directory
- Agent prompt files in prompts directory
- Any README files
- TypeScript files that may reference the path

## Success Criteria
- `planning/done/` no longer exists
- `planning/docs/` contains all previous content
- All references updated to use new name
- System functions normally with new directory structure
- Documentation reflects the new naming convention