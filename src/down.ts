#!/usr/bin/env node

import { execSync } from 'child_process';

// Kill Manager container
function killManager() {
  const containerName = 'claudo-manager';
  
  try {
    console.log('[claudo] Stopping Manager...');
    // First try graceful stop
    try {
      execSync(`docker stop ${containerName}`, { stdio: 'inherit' });
    } catch (e) {
      // If stop didn't work, force kill
      try {
        execSync(`docker kill ${containerName}`, { stdio: 'inherit' });
      } catch (e2) {
        // Container not running
      }
    }
    
    // Always try to remove the container (needed since we removed --rm in detached mode)
    try {
      execSync(`docker rm ${containerName}`, { stdio: 'ignore' });
    } catch (e) {
      // Container doesn't exist or already removed
    }
    
    console.log('[claudo] Manager stopped.');
  } catch (error) {
    console.log('[claudo] No Manager running.');
  }
}

killManager();