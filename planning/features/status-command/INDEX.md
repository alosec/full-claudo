# Status Command Feature Request

## Original Request
Add 'claudo status' command that shows if manager is running and displays recent activity

## Purpose
Users need a quick way to check:
1. Whether the claudo manager container is running
2. Recent work activity and logs
3. Current system status

## Implementation Requirements
- Add `status` command to claudo CLI
- Show manager container status (running/stopped)
- Display recent work-log entries
- Show current tasks if any
- Provide helpful troubleshooting info

## Success Criteria
- [ ] `claudo status` command available in CLI
- [ ] Shows manager running/stopped state
- [ ] Displays recent activity from work-log
- [ ] Provides useful troubleshooting information
- [ ] Command works whether manager is running or not