import { existsSync } from 'fs';
import * as path from 'path';

export enum ExecutionContext {
  NATIVE = 'native',
  DOCKER = 'docker'
}

/**
 * Detects current execution context based on environment
 */
export function detectContext(): ExecutionContext {
  // Check for Docker environment marker
  if (existsSync('/.dockerenv')) {
    return ExecutionContext.DOCKER;
  }
  
  // Check for workspace mount (Docker indicator)
  if (process.cwd() === '/workspace' || existsSync('/workspace')) {
    return ExecutionContext.DOCKER;
  }
  
  return ExecutionContext.NATIVE;
}

/**
 * Resolves prompt file path based on execution context
 */
export function resolvePromptPath(promptFile: string, context?: ExecutionContext): string {
  const actualContext = context || detectContext();
  
  if (actualContext === ExecutionContext.DOCKER) {
    return path.join('/workspace/prompts', promptFile);
  } else {
    return path.join(process.cwd(), 'prompts', promptFile);
  }
}

/**
 * Resolves working directory based on execution context
 */
export function resolveWorkingDirectory(context?: ExecutionContext): string {
  const actualContext = context || detectContext();
  
  if (actualContext === ExecutionContext.DOCKER) {
    return '/workspace';
  } else {
    return process.cwd();
  }
}

/**
 * Get preferred execution context for different command types
 */
export function getPreferredContext(commandType: 'agent' | 'manager'): ExecutionContext {
  if (commandType === 'manager') {
    return ExecutionContext.DOCKER;
  } else {
    return ExecutionContext.NATIVE;
  }
}