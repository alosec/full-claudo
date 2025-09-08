import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import * as path from 'path';

const IMAGE_NAME = 'claudo-container';
const STATE_FILE = '.claudo/docker-state.json';

interface DockerState {
  imageId?: string;
  buildTime?: string;
  version?: string;
  lastCheckTime?: string;
}

export class DockerManager {
  private projectRoot: string;
  private stateFile: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.stateFile = path.join(projectRoot, STATE_FILE);
    this.ensureStateDirectory();
  }

  private ensureStateDirectory() {
    const claudoDir = path.join(this.projectRoot, '.claudo');
    mkdirSync(claudoDir, { recursive: true });
  }

  private loadState(): DockerState {
    if (existsSync(this.stateFile)) {
      try {
        return JSON.parse(readFileSync(this.stateFile, 'utf-8'));
      } catch {
        return {};
      }
    }
    return {};
  }

  private saveState(state: DockerState) {
    writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
  }

  public imageExists(): boolean {
    try {
      execSync(`docker image inspect ${IMAGE_NAME} > /dev/null 2>&1`);
      return true;
    } catch {
      return false;
    }
  }

  public getImageInfo(): { id: string; created: string } | null {
    try {
      const info = execSync(
        `docker image inspect ${IMAGE_NAME} --format '{{.Id}}|{{.Created}}'`,
        { encoding: 'utf-8' }
      ).trim();
      const [id, created] = info.split('|');
      return { id, created };
    } catch {
      return null;
    }
  }

  public async buildImage(verbose: boolean = true): Promise<boolean> {
    const dockerfilePath = path.join(this.projectRoot, 'docker', 'Dockerfile');
    
    if (!existsSync(dockerfilePath)) {
      console.error('[claudo] Error: Dockerfile not found at docker/Dockerfile');
      return false;
    }

    if (verbose) {
      console.log('[claudo] Building Docker image...');
      console.log('[claudo] This may take a few minutes on first build...');
    }

    try {
      const buildProcess = spawn('docker', [
        'build',
        '-t', IMAGE_NAME,
        '-f', dockerfilePath,
        '--label', `claudo.version=${this.getProjectVersion()}`,
        '--label', `claudo.buildtime=${new Date().toISOString()}`,
        this.projectRoot
      ], {
        stdio: verbose ? 'inherit' : 'pipe',
        cwd: this.projectRoot
      });

      return new Promise((resolve) => {
        buildProcess.on('close', (code) => {
          if (code === 0) {
            const imageInfo = this.getImageInfo();
            if (imageInfo) {
              this.saveState({
                imageId: imageInfo.id,
                buildTime: new Date().toISOString(),
                version: this.getProjectVersion(),
                lastCheckTime: new Date().toISOString()
              });
            }
            if (verbose) {
              console.log('[claudo] Docker image built successfully!');
            }
            resolve(true);
          } else {
            if (verbose) {
              console.error('[claudo] Docker build failed with exit code:', code);
            }
            resolve(false);
          }
        });

        buildProcess.on('error', (error) => {
          console.error('[claudo] Failed to start Docker build:', error.message);
          resolve(false);
        });
      });
    } catch (error: any) {
      console.error('[claudo] Docker build error:', error.message);
      return false;
    }
  }

  public async ensureImage(autoBuild: boolean = true): Promise<boolean> {
    if (this.imageExists()) {
      return true;
    }

    if (autoBuild) {
      console.log('[claudo] Docker image not found. Building automatically...');
      return await this.buildImage();
    } else {
      console.error('[claudo] Error: Docker image "claudo-container" not found.');
      console.error('[claudo] Run "claudo build" to build the image.');
      return false;
    }
  }

  public shouldRebuild(): boolean {
    const state = this.loadState();
    if (!state.buildTime || !this.imageExists()) {
      return true;
    }

    // Check if source files are newer than last build
    const srcFiles = [
      'package.json',
      'tsconfig.json',
      'docker/Dockerfile'
    ];

    const buildTime = new Date(state.buildTime).getTime();
    
    for (const file of srcFiles) {
      const filePath = path.join(this.projectRoot, file);
      if (existsSync(filePath)) {
        const stats = require('fs').statSync(filePath);
        if (stats.mtimeMs > buildTime) {
          return true;
        }
      }
    }

    return false;
  }

  private getProjectVersion(): string {
    try {
      const packageJson = JSON.parse(
        readFileSync(path.join(this.projectRoot, 'package.json'), 'utf-8')
      );
      return packageJson.version || '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  public async checkAndUpdateImage(): Promise<boolean> {
    if (!this.imageExists()) {
      console.log('[claudo] Docker image missing.');
      return await this.buildImage();
    }

    if (this.shouldRebuild()) {
      console.log('[claudo] Source files changed. Rebuilding Docker image...');
      return await this.buildImage();
    }

    return true;
  }

  public getStatus(): string {
    const state = this.loadState();
    const imageInfo = this.getImageInfo();
    
    let status = 'Docker Image Status:\n';
    
    if (imageInfo) {
      status += `  ✓ Image exists (${IMAGE_NAME})\n`;
      status += `  - ID: ${imageInfo.id.substring(0, 12)}\n`;
      status += `  - Created: ${new Date(imageInfo.created).toLocaleString()}\n`;
      if (state.version) {
        status += `  - Version: ${state.version}\n`;
      }
    } else {
      status += `  ✗ Image not found (${IMAGE_NAME})\n`;
      status += `  - Run "claudo build" to create it\n`;
    }

    if (this.shouldRebuild()) {
      status += '\n  ⚠ Source files changed - rebuild recommended\n';
    }

    return status;
  }
}