#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
// Kill Manager container
function killManager() {
    const containerName = 'claudo-manager';
    try {
        console.log('[claudo] Stopping Manager...');
        (0, child_process_1.execSync)(`docker kill ${containerName}`, { stdio: 'inherit' });
        (0, child_process_1.execSync)(`docker rm ${containerName}`, { stdio: 'inherit' });
        console.log('[claudo] Manager stopped.');
    }
    catch (error) {
        console.log('[claudo] No Manager running.');
    }
}
killManager();
