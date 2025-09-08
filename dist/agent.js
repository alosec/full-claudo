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
const parser_1 = require("./parser");
// Spawn Claude agent as Node.js process within container
function spawnAgent() {
    const [, , agentType, ...promptArgs] = process.argv;
    if (!agentType || !['plan', 'worker', 'critic', 'oracle'].includes(agentType)) {
        console.error('Usage: claudo {plan|worker|critic|oracle} <prompt>');
        process.exit(1);
    }
    // Map 'plan' to 'planner' for consistency
    const promptFile = agentType === 'plan' ? 'planner' : agentType;
    // Read prompts from container's installed location
    const basePrompt = (0, fs_1.readFileSync)(`/usr/local/lib/claudo/prompts/${promptFile}.md`, 'utf8');
    const userPrompt = promptArgs.join(' ');
    const fullPrompt = `${basePrompt}\n\nTask: ${userPrompt}`;
    // Ensure .claudo directory exists
    const claudoDir = path.join(process.cwd(), '.claudo');
    (0, fs_1.mkdirSync)(claudoDir, { recursive: true });
    // Write prompt to temporary file
    const tempPromptFile = path.join(claudoDir, `${agentType}-prompt.txt`);
    (0, fs_1.writeFileSync)(tempPromptFile, fullPrompt);
    // Determine input format based on stdin
    const hasInput = !process.stdin.isTTY;
    const inputFormat = hasInput ? 'stream-json' : 'text';
    // Spawn Claude process
    const claude = (0, child_process_1.spawn)('claude', [
        '-p', `$(cat ${tempPromptFile})`,
        '--dangerously-skip-permissions',
        '--output-format', 'stream-json',
        '--input-format', inputFormat,
        '--verbose',
        '--model', 'sonnet'
    ], {
        stdio: ['pipe', 'pipe', 'inherit'],
        shell: true
    });
    // Set up stream parsing for human-readable output
    const parser = new parser_1.ClaudeStreamParser(agentType.charAt(0).toUpperCase() + agentType.slice(1));
    // Connect streams
    if (hasInput) {
        process.stdin.pipe(claude.stdin);
    }
    claude.stdout.pipe(parser);
    claude.on('close', (code) => {
        process.exit(code || 0);
    });
}
spawnAgent();
