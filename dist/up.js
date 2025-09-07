#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path = __importStar(require("path"));
// Spawn Manager Claude in Docker container
function spawnManager() {
    const prompt = (0, fs_1.readFileSync)('/usr/local/lib/claudo/prompts/manager.md', 'utf8');
    const containerName = 'claudo-manager';
    // Kill existing manager if running
    try {
        (0, child_process_1.execSync)(`docker kill ${containerName} 2>/dev/null`, { stdio: 'ignore' });
    }
    catch (e) {
        // Container not running, that's fine
    }
    // Ensure .claudo directory exists
    const claudoDir = path.join(process.cwd(), '.claudo');
    (0, fs_1.mkdirSync)(claudoDir, { recursive: true });
    // Write prompt to temporary file to avoid shell escaping issues
    const tempPromptFile = path.join(claudoDir, 'manager-prompt.txt');
    require('fs').writeFileSync(tempPromptFile, prompt);
    // Start new manager container
    const cmd = `docker run -d --name ${containerName} \\
    -v "$(pwd):/workspace" \\
    -v "$HOME/.claude/.credentials.json:/home/node/.claude/.credentials.json:ro" \\
    -v "$HOME/.claude/settings.json:/home/node/.claude/settings.json:ro" \\
    -e PATH="/workspace:\$PATH" \\
    claudo-container \\
    sh -c 'claude -p "$(cat /workspace/.claudo/manager-prompt.txt)" --dangerously-skip-permissions --output-format stream-json --verbose --model sonnet'`;
    console.log('[claudo] Spawning Manager in Docker...');
    (0, child_process_1.execSync)(cmd, { stdio: 'inherit', cwd: process.cwd() });
    console.log('[claudo] Manager started. Use "claudo down" to stop.');
}
spawnManager();
