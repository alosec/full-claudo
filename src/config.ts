/**
 * Configuration system for claudo debug modes and settings
 */

export interface ClaudoConfig {
  debugMode: boolean;
}

/**
 * Get claudo configuration from environment variables
 */
export function getConfig(): ClaudoConfig {
  return {
    debugMode: process.env.DEBUG_MODE === 'true' || process.env.DEBUG_MODE === '1'
  };
}

/**
 * Check if debug mode is enabled
 */
export function isDebugMode(): boolean {
  return getConfig().debugMode;
}

/**
 * Conditionally log debug messages based on DEBUG_MODE environment variable
 */
export function debugLog(message: string, ...args: any[]): void {
  if (isDebugMode()) {
    console.error(`[claudo-debug] ${message}`, ...args);
  }
}