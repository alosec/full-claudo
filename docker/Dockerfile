FROM node:18-alpine

# Install Claude CLI, git, and bash for proper shell environment
RUN npm install -g @anthropic-ai/claude-code && \
    apk add --no-cache git bash

# Use existing node user (UID 1000) for file permissions compatibility
# Create Claude CLI configuration directory for node user
RUN mkdir -p /home/node/.claude && chown node:node /home/node/.claude

# Copy claudo installation files to container
COPY claudo /usr/local/bin/claudo
COPY dist/ /usr/local/lib/claudo/dist/
COPY prompts/ /usr/local/lib/claudo/prompts/
RUN chmod +x /usr/local/bin/claudo

# Set working directory
WORKDIR /workspace

# Set shell environment for Claude CLI compatibility
ENV SHELL=/bin/bash

# Switch to node user (UID 1000)
USER node

# Default command (will be overridden)
CMD ["claude", "--help"]