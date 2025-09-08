Fix claudo status command - currently returns blank output instead of showing system status

The status command was implemented but appears to output nothing when run. 
Need to debug why src/status.ts isn't producing visible output.
Should show:
- Manager container status (running/stopped)
- Recent activity from work logs
- Current tasks from planning/INDEX.md
- Helpful next steps for users