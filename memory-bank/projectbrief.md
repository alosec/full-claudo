# Full Claudo - Simple Multi-Agent System

## Project Overview

Full Claudo is a minimal multi-agent system that automates software development workflows using Claude instances. It implements the proven `/prepare`, `/plan`, `/act` workflow but with automated orchestration.

## Core Architecture

- **Manager**: Long-running Claude that reads tasks and orchestrates other agents
- **Planner**: Creates detailed implementation plans for tasks
- **Worker**: Executes code changes (only agent authorized to edit files)
- **Critic**: Reviews plans and implementations for quality
- **Oracle**: Provides strategic guidance when stuck

## Key Principles

1. **Simplicity**: Total infrastructure is ~100 lines of TypeScript
2. **Security**: All Claude instances run in Docker sandboxes with `--dangerously-skip-permissions`
3. **Minimal State**: No complex state management - Manager handles coordination
4. **Unix Philosophy**: Simple text files for communication and queuing

## Project Goals

- Automate the human orchestrator role in proven Claude workflows
- Enable truly autonomous development from high-level task descriptions
- Maintain simplicity while supporting complex multi-step projects
- Provide safe sandboxed execution environment

## Current Status

- ✅ Core architecture implemented and **working**
- ✅ Docker sandbox configured and **operational**
- ✅ Agent prompts defined for all 5 agent types
- ✅ Manager successfully spawned and **reading memory-bank**
- ✅ Streaming JSON output providing **real-time visibility**
- ✅ Task queue integration **working**
- 🚧 Shell environment fix needed for agent spawning

## Success Criteria

- ✅ Manager can read memory-bank and understand project context
- 🚧 Manager can spawn other agents via `claudo plan/worker/critic/oracle` (shell fix needed)
- ✅ Agents execute in secure Docker containers
- ⏳ Work is automatically saved to git (pending full workflow)
- ⏳ Complex tasks can be broken down and executed autonomously (pending agent spawning)

## Key Achievement

The **simple architecture works**! We've proven that ~100 lines of TypeScript can successfully orchestrate Claude instances without complex frameworks. The Manager reads project context, understands tasks, and is ready to coordinate other agents once the shell environment is configured.