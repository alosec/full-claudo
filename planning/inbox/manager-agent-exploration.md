# Manager Agent Exploration and Planner Initialization

## Problem
The current specific script approach for agent management is tedious. The manager is currently unable to spawn agents, and we need a more streamlined approach for agent calling. While a one-line shell alias should exist via claudo, there may be mismatched expectations regarding Docker-in-Docker handling.

## Task
1. Explore attempts to properly spawn agents through the manager
2. If successful, initialize a planner agent to plan a refactor switching to that agent-calling method
3. Investigate potential Docker-in-Docker issues that may be causing CLI handling problems

## Context
- Current agent spawning through manager is failing
- Specific script method is cumbersome and needs improvement
- Claude CLI should provide a simpler interface but may have Docker compatibility issues
- Need to identify root cause of agent spawning failures

## Acceptance Criteria
- [ ] Investigate why manager cannot spawn agents currently
- [ ] Test various approaches to agent spawning
- [ ] Document Docker-in-Docker compatibility issues if found
- [ ] If agent spawning is resolved, init planner agent for refactor planning
- [ ] Identify path to simpler one-line shell alias solution
- [ ] Document findings and recommended approach

## Technical Considerations
- Docker-in-Docker environment complexities
- CLI expectations vs actual capabilities
- Agent communication patterns
- Process spawning limitations in containerized environments