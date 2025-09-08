# Inbox - Feature Request Drop Zone

## How to Submit Features

Drop markdown files here with your feature requests or bug reports. The Manager will automatically process them.

### Format

Simply create a `.md` file with any name describing your feature:

```bash
# Examples:
echo "Add dark mode toggle to settings" > planning/inbox/dark-mode.md
echo "Fix login timeout issue - should be 30 minutes not 5" > planning/inbox/fix-login.md
```

### What Happens Next

1. Manager reads your request
2. Creates a feature directory in `planning/features/[feature-name]/`
3. Assigns to Planner to create implementation plan
4. Worker implements the plan
5. Critic reviews the implementation
6. Your original request moves to `planning/done/` with timestamp

### Guidelines

- Be as specific or vague as you like - the Planner will figure it out
- Include any technical requirements or constraints
- Reference existing code or patterns if relevant
- No special format required - just plain text or markdown

### Example Requests

**Simple:**
```
Add user avatar upload feature
```

**Detailed:**
```
Implement autocomplete for the search bar using:
- Fuse.js for fuzzy matching
- Debounce user input by 300ms
- Show max 10 results
- Include keyboard navigation
```

**Bug Report:**
```
Users getting logged out after 5 minutes.
Should be 30 minutes per requirements.
Check JWT expiry and session management.
```

## Status

Check `planning/INDEX.md` to see processing status of your requests.