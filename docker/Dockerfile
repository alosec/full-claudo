FROM node:18-alpine

# Install Claude CLI, git, and bash for proper shell environment
RUN npm install -g @anthropic-ai/claude-code && \
    apk add --no-cache git bash

# Use existing node user (UID 1000) for file permissions compatibility
# Create Claude CLI configuration directory for node user
RUN mkdir -p /home/node/.claude && chown node:node /home/node/.claude

# Create claudo library directory
RUN mkdir -p /usr/local/lib/claudo && chown node:node /usr/local/lib/claudo

# Copy all source files to container for building
COPY --chown=node:node package*.json /usr/local/lib/claudo/
COPY --chown=node:node tsconfig.json /usr/local/lib/claudo/
COPY --chown=node:node src/ /usr/local/lib/claudo/src/
COPY --chown=node:node prompts/ /usr/local/lib/claudo/prompts/
COPY --chown=node:node claudo /usr/local/bin/claudo

# Switch to node user and build directory
USER node
WORKDIR /usr/local/lib/claudo

# Install dependencies and build TypeScript
RUN npm install && npm run build

# Make claudo executable
USER root
RUN chmod +x /usr/local/bin/claudo

# Set working directory back to workspace
WORKDIR /workspace

# Set shell environment for Claude CLI compatibility
ENV SHELL=/bin/bash
ENV PATH="/usr/local/lib/claudo/dist:$PATH"

# Switch back to node user
USER node

# Default command (will be overridden)
CMD ["claude", "--help"]