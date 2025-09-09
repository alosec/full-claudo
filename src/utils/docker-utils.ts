import { execSync } from 'child_process';
import { ExecutionContext } from '../execution-context';

export function isDockerRunning(): boolean {
  try {
    execSync('docker info > /dev/null 2>&1');
    return true;
  } catch {
    return false;
  }
}

export function containerExists(name: string): boolean {
  try {
    execSync(`docker container inspect ${name} > /dev/null 2>&1`);
    return true;
  } catch {
    return false;
  }
}

export function getContainerStatus(name: string): string | null {
  try {
    return execSync(
      `docker inspect -f '{{.State.Status}}' ${name} 2>/dev/null`,
      { encoding: 'utf-8' }
    ).trim();
  } catch {
    return null;
  }
}

export function removeContainer(name: string): boolean {
  try {
    execSync(`docker rm -f ${name} > /dev/null 2>&1`);
    return true;
  } catch {
    return false;
  }
}

export function getImageDigest(name: string): string | null {
  try {
    return execSync(
      `docker image inspect ${name} --format '{{.Id}}'`,
      { encoding: 'utf-8' }
    ).trim();
  } catch {
    return null;
  }
}

export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export function getImageSize(name: string): string | null {
  try {
    const sizeStr = execSync(
      `docker image inspect ${name} --format '{{.Size}}'`,
      { encoding: 'utf-8' }
    ).trim();
    const bytes = parseInt(sizeStr, 10);
    return formatBytes(bytes);
  } catch {
    return null;
  }
}

export function ensureDockerAvailable(): boolean {
  if (!isDockerRunning()) {
    console.error('[claudo] Error: Docker is not running or not installed.');
    console.error('[claudo] Please ensure Docker Desktop is running and try again.');
    return false;
  }
  return true;
}

/**
 * Check if Docker execution is available for fallback scenarios
 */
export function canRunInDocker(): boolean {
  return isDockerRunning();
}

/**
 * Get the preferred execution context for different command types
 */
export function getPreferredExecutionContext(commandType: 'agent' | 'manager'): ExecutionContext {
  if (commandType === 'manager') {
    return ExecutionContext.DOCKER;
  } else {
    // Agents prefer native execution by default
    return ExecutionContext.NATIVE;
  }
}

/**
 * Resolve execution context with fallback logic
 */
export function resolveExecutionContext(
  requested?: ExecutionContext,
  commandType: 'agent' | 'manager' = 'agent'
): ExecutionContext {
  // If user explicitly requested a context, try to honor it
  if (requested) {
    if (requested === ExecutionContext.DOCKER && !canRunInDocker()) {
      console.warn('[claudo] Warning: Docker requested but not available, falling back to native execution');
      return ExecutionContext.NATIVE;
    }
    return requested;
  }
  
  // Otherwise use preferences
  const preferred = getPreferredExecutionContext(commandType);
  
  // For Docker preference, ensure Docker is available
  if (preferred === ExecutionContext.DOCKER && !canRunInDocker()) {
    console.warn('[claudo] Warning: Docker preferred but not available, falling back to native execution');
    return ExecutionContext.NATIVE;
  }
  
  return preferred;
}