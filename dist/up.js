#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
// Spawn Manager Claude in Docker container with new streaming architecture
function spawnManager() {
    const containerName = 'claudo-manager';
    // Check if container exists and handle appropriately
    try {
        const containerStatus = (0, child_process_1.execSync)(`docker inspect -f '{{.State.Status}}' ${containerName} 2>/dev/null`, {
            encoding: 'utf-8'
        }).trim();
        if (containerStatus === 'running') {
            console.log(`[claudo] Manager is already running in container '${containerName}'.`);
            console.log('[claudo] Use "claudo down" to stop it first, or "claudo logs" to view output.');
            return;
        }
        else if (containerStatus === 'exited' || containerStatus === 'created') {
            console.log(`[claudo] Removing stopped container '${containerName}'...`);
            (0, child_process_1.execSync)(`docker rm ${containerName}`, { stdio: 'ignore' });
        }
    }
    catch (e) {
        // Container doesn't exist, which is fine
    }
    // Start new manager container
    // The Docker image already contains all the built code and prompts
    // We just mount the current working directory as /workspace
    const cmd = `docker run -d --name ${containerName} \
    -v "$(pwd):/workspace" \
    -v "$HOME/.claude/.credentials.json:/home/node/.claude/.credentials.json:ro" \
    -v "$HOME/.claude/settings.json:/home/node/.claude/settings.json:ro" \
    -w /workspace \
    claudo-container \
    node /usr/local/lib/claudo/dist/manager-runner.js`;
    console.log('[claudo] Spawning Manager with streaming JSON bus...');
    try {
        const containerId = (0, child_process_1.execSync)(cmd, { encoding: 'utf-8', cwd: process.cwd() }).trim();
        console.log(`[claudo] Manager started (${containerId.substring(0, 12)}).`);
        console.log('[claudo] Use "claudo logs -f" to follow output or "claudo down" to stop.');
    }
    catch (error) {
        if (error.message.includes('Unable to find image')) {
            console.error('[claudo] Error: Docker image "claudo-container" not found.');
            console.error('[claudo] Please build the image first with:');
            console.error('  cd /path/to/full-claudo && docker build -t claudo-container docker/');
        }
        else {
            console.error('[claudo] Error starting manager:', error.message);
        }
        process.exit(1);
    }
}
spawnManager();
