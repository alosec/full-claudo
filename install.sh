#!/bin/bash

# Full Claudo System Installation Script

set -e

echo "[claudo] Installing claudo system-wide..."

# Build TypeScript first
echo "[claudo] Building TypeScript..."
npm run build

# Create installation directories
echo "[claudo] Creating installation directories..."
sudo mkdir -p /usr/local/lib/claudo

# Copy files to system locations
echo "[claudo] Copying files..."
sudo cp -r dist /usr/local/lib/claudo/
sudo cp -r prompts /usr/local/lib/claudo/
sudo cp claudo /usr/local/bin/
sudo chmod +x /usr/local/bin/claudo

# Build Docker container with updated files
echo "[claudo] Building Docker container..."
docker build -t claudo-container -f docker/Dockerfile .

echo "[claudo] Installation complete!"
echo "[claudo] You can now run 'claudo up' from any project directory."
echo "[claudo] Use 'claudo --help' to see available commands."