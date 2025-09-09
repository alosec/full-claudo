# Test Scenario: Planner Agent Validation

## Scenario Description
Test the Planner agent's ability to create and organize tasks within the Full Claudo multi-agent system by giving it a realistic development task to plan.

## Test Task to Give Planner
**Task**: "Create a status dashboard that shows the current state of all running agents and their recent activity"

## Expected Planner Behavior
The Planner agent should:

1. **Read and analyze memory-bank files** to understand:
   - Full Claudo is a multi-agent system with 5 agent types
   - Current architecture has Manager running in Docker
   - Agent spawning has critical blocker (Manager can't spawn agents from container)
   - System uses Docker sandboxes for security
   - Communication happens via clean text responses

2. **Create proper task structure**:
   - Directory: `planning/tasks/implement-status-dashboard/`
   - README.md with all required sections
   - Proper hierarchical organization if subtasks needed

3. **Demonstrate project understanding** by:
   - Referencing current blockers in planning
   - Understanding the Docker architecture
   - Knowing about the 5 agent types (Manager, Planner, Worker, Critic, Oracle)
   - Mentioning session monitoring and log integration patterns

4. **Update planning system**:
   - Add new task to planning/INDEX.md
   - Follow established naming conventions
   - Set appropriate priority based on project needs

## Test Execution Plan

### Step 1: Preparation
- Create test scenario document (this file)
- Ensure claudo command is available
- Prepare memory-bank with current context

### Step 2: Execute Test
```bash
claudo plan "Create a status dashboard that shows the current state of all running agents and their recent activity"
```

### Step 3: Validation
- Check if task directory created correctly
- Verify README.md format and content
- Confirm planning/INDEX.md updated
- Document evidence of memory-bank context understanding

## Success Indicators

✅ **Context Understanding**: Task references current architecture and blockers
✅ **Structure Compliance**: Follows planning/tasks/README.md format exactly  
✅ **System Integration**: planning/INDEX.md properly updated
✅ **Technical Accuracy**: Shows understanding of Docker, agents, sessions
✅ **Actionable Planning**: Creates implementable steps for Worker agent

## Failure Indicators

❌ **Generic Planning**: Task doesn't reference Full Claudo specifics
❌ **Format Errors**: README.md missing sections or wrong structure
❌ **No Integration**: planning/INDEX.md not updated
❌ **Context Blindness**: Doesn't acknowledge current blockers or architecture
❌ **Non-actionable**: Steps too vague for Worker implementation

## Expected Outputs

1. **New directory**: `planning/tasks/implement-status-dashboard/`
2. **Task README**: With full format including status, requirements, acceptance criteria
3. **Updated INDEX**: planning/INDEX.md shows new task in appropriate priority section  
4. **Context evidence**: Task content references memory-bank information

This test validates that the Planner agent can successfully analyze project context and create well-structured, actionable tasks within the Full Claudo system.