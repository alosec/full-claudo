# Done - Processed Feature Archive

## Overview

This directory contains all processed inbox items that have been:
- Planned by the Planner agent
- Implemented by the Worker agent
- Reviewed by the Critic agent
- Committed to git

## File Naming Convention

Files are automatically moved here from `planning/inbox/` with timestamps:

```
YYYY-MM-DD-original-filename.md
```

Examples:
- `2025-09-08-dark-mode.md`
- `2025-09-08-fix-login.md`
- `2025-09-08-autocomplete.md`

## File Contents

Each file preserves the original feature request exactly as submitted, providing a historical record of what was requested vs what was implemented.

## Cross-Reference

To see what was actually implemented for each request:
- Check `planning/features/[feature-name]/` for the planning documents
- Check `work-log/` for implementation details
- Check git log for the actual commits

## Status Tracking

The implementation status of each item can be found in:
- `planning/INDEX.md` - Overall status tracking
- `planning/features/[feature-name]/plan.md` - Detailed implementation plan
- `work-log/YYYY-MM-DD-HHMM-feature.md` - Completion details