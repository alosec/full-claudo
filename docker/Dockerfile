FROM node:18-alpine

# Install Claude CLI, git, and bash for proper shell environment
RUN npm install -g @anthropic-ai/claude-code && \
    apk add --no-cache git bash

# Use existing node user (UID 1000) for file permissions compatibility
# Create Claude CLI configuration directory for node user
RUN mkdir -p /home/node/.claude && chown node:node /home/node/.claude

# Create workspace directory with proper permissions
RUN mkdir -p /workspace && chown node:node /workspace

# Copy all source files to workspace for building
COPY --chown=node:node package*.json /workspace/
COPY --chown=node:node tsconfig.json /workspace/
COPY --chown=node:node src/ /workspace/src/
COPY --chown=node:node prompts/ /workspace/prompts/
COPY --chown=node:node claudo /workspace/claudo

# Switch to node user and build directory
USER node
WORKDIR /workspace

# Install dependencies and build TypeScript
RUN npm install && npm run build

# Make claudo script executable
USER root
RUN chmod +x /workspace/claudo

# Set working directory back to workspace
WORKDIR /workspace

# Set shell environment for Claude CLI compatibility and add claudo to PATH
ENV SHELL=/bin/bash
ENV PATH="/workspace:/workspace/dist/src:$PATH"

# Switch back to node user
USER node

# Default command (will be overridden)
CMD ["claude", "--help"]