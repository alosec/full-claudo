/**
 * TTY Detection Utility
 * Determines if we're running in a TTY environment and provides
 * appropriate Docker flags and output strategies.
 */

export interface TTYStrategy {
  dockerFlags: string;
  isInteractive: boolean;
  outputMode: 'console' | 'file';
  outputFile?: string;
}

export function detectTTY(): TTYStrategy {
  const isTTY = process.stdout.isTTY && process.stdin.isTTY;
  
  if (isTTY) {
    // Real terminal - use interactive mode
    return {
      dockerFlags: '-it --rm',
      isInteractive: true,
      outputMode: 'console'
    };
  } else {
    // Non-TTY (Claude Code, CI, etc.) - use detached mode without --rm so we can get logs
    return {
      dockerFlags: '-d',
      isInteractive: false,
      outputMode: 'file',
      outputFile: '/workspace/.claudo/manager-output.log'
    };
  }
}

export function getDockerCommand(containerName: string, strategy: TTYStrategy): string {
  return `docker run ${strategy.dockerFlags} --name ${containerName} \
    -v "$(pwd):/workspace" \
    -v "$HOME/.claude/.credentials.json:/home/node/.claude/.credentials.json:ro" \
    -v "$HOME/.claude/settings.json:/home/node/.claude/settings.json:ro" \
    -w /workspace \
    claudo-container \
    node /workspace/dist/src/manager-runner.js${strategy.outputMode === 'file' ? ' --output-file' : ''}`;
}