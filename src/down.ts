#!/usr/bin/env node

import { execSync } from 'child_process';

// Kill Manager container
function killManager() {
  const containerName = 'claudo-manager';
  
  try {
    console.log('[claudo] Stopping Manager...');
    execSync(`docker kill ${containerName}`, { stdio: 'inherit' });
    execSync(`docker rm ${containerName}`, { stdio: 'inherit' });
    console.log('[claudo] Manager stopped.');
  } catch (error) {
    console.log('[claudo] No Manager running.');
  }
}

killManager();