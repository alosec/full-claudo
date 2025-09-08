import { execSync } from 'child_process';

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