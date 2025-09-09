import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import { ExecutionContext, detectContext, resolvePromptPath, resolveWorkingDirectory } from './execution-context';

export interface PromptResolverOptions {
  customPromptFile?: string;
  executionContext?: ExecutionContext;
  agentType?: string;
}

export class PromptResolver {
  private context: ExecutionContext;

  constructor(context?: ExecutionContext) {
    this.context = context || detectContext();
  }

  /**
   * Resolve and read prompt file content
   */
  resolve(options: PromptResolverOptions): string {
    const { customPromptFile, agentType } = options;

    // If custom prompt file is provided, try to read it
    if (customPromptFile) {
      const customPrompt = this.readCustomPromptFile(customPromptFile);
      if (customPrompt) {
        return customPrompt;
      }
      console.warn(`[claudo] Warning: Custom prompt file not found: ${customPromptFile}`);
      console.warn(`[claudo] Falling back to default prompt for ${agentType}`);
    }

    // Fall back to default prompt
    if (agentType) {
      return this.readDefaultPromptFile(agentType);
    }

    throw new Error('Either customPromptFile or agentType must be provided');
  }

  /**
   * Read custom prompt file with context-aware path resolution
   */
  private readCustomPromptFile(promptFile: string): string | null {
    let resolvedPath: string;

    // If absolute path, use as-is
    if (path.isAbsolute(promptFile)) {
      resolvedPath = promptFile;
    } else {
      // Resolve relative path based on execution context
      const workDir = resolveWorkingDirectory(this.context);
      resolvedPath = path.resolve(workDir, promptFile);
    }

    // Check if file exists and read it
    if (existsSync(resolvedPath)) {
      try {
        return readFileSync(resolvedPath, 'utf8');
      } catch (error) {
        console.error(`[claudo] Error reading custom prompt file: ${error}`);
        return null;
      }
    }

    // For Docker context, also try host path if container path fails
    if (this.context === ExecutionContext.DOCKER && !path.isAbsolute(promptFile)) {
      const hostPath = path.resolve(process.cwd(), promptFile);
      if (existsSync(hostPath)) {
        try {
          return readFileSync(hostPath, 'utf8');
        } catch (error) {
          console.error(`[claudo] Error reading custom prompt file from host: ${error}`);
        }
      }
    }

    return null;
  }

  /**
   * Read default prompt file for agent type
   */
  private readDefaultPromptFile(agentType: string): string {
    // Map 'plan' to 'planner' for consistency
    const promptFile = agentType === 'plan' ? 'planner' : agentType;
    const promptFileName = `${promptFile}.md`;
    const promptPath = resolvePromptPath(promptFileName, this.context);

    if (!existsSync(promptPath)) {
      throw new Error(`Default prompt file not found: ${promptPath}`);
    }

    try {
      return readFileSync(promptPath, 'utf8');
    } catch (error) {
      throw new Error(`Error reading default prompt file ${promptPath}: ${error}`);
    }
  }

  /**
   * Get execution context
   */
  getContext(): ExecutionContext {
    return this.context;
  }
}