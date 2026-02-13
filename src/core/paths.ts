/**
 * XDG Base Directory Specification compliant path resolution
 * Provides consistent paths across Linux, macOS, and Windows
 */

import { homedir, platform } from 'os';
import { join } from 'path';
import { chmod, mkdir, stat } from 'fs/promises';

/**
 * Paths manager following XDG Base Directory spec
 * https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html
 */
export class Paths {
  private static instance: Paths;

  private constructor() {}

  static getInstance(): Paths {
    if (!Paths.instance) {
      Paths.instance = new Paths();
    }
    return Paths.instance;
  }

  get skillDir(): string {
    return process.env.NOTEBOOKLM_SKILL_DIR || join(homedir(), '.claude', 'skills', 'notebooklm');
  }

  get dataDir(): string {
    // Use skill directory for backward compatibility with Python version
    return join(this.skillDir, 'data');
  }

  get configDir(): string {
    return join(this.skillDir, 'config');
  }

  get cacheDir(): string {
    // Use skill directory for backward compatibility
    return join(this.skillDir, 'cache');
  }

  get browserStateDir(): string {
    return join(this.dataDir, 'browser_state');
  }

  get browserProfileDir(): string {
    return join(this.browserStateDir, 'browser_profile');
  }

  get stateFile(): string {
    return join(this.browserStateDir, 'state.json');
  }

  get authInfoFile(): string {
    return join(this.dataDir, 'auth_info.json');
  }

  get libraryFile(): string {
    return join(this.dataDir, 'library.json');
  }

  get cacheFile(): string {
    return join(this.cacheDir, 'response_cache.json');
  }

  get logsDir(): string {
    return join(this.dataDir, 'logs');
  }


  isUnix(): boolean {
    return platform() !== 'win32';
  }

  async ensureDataDir(): Promise<void> {
    if (!this.isUnix()) {
      return;
    }

    try {
      await mkdir(this.dataDir, { recursive: true, mode: 0o700 });
      await chmod(this.dataDir, 0o700);
    } catch (error) {
      console.warn(`Could not set permissions on ${this.dataDir}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async setSecureFilePermissions(filePath: string): Promise<void> {
    if (!this.isUnix()) {
      return;
    }

    try {
      await chmod(filePath, 0o600);
    } catch (error) {
      console.warn(`Could not set permissions on ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async ensureSecurePermissions(): Promise<void> {
    if (!this.isUnix()) {
      return;
    }

    const issues: string[] = [];

    try {
      await this.ensureDataDir();

      const dataStats = await stat(this.dataDir);
      const dataMode = dataStats.mode & 0o777;

      if (dataMode & 0o007) {
        issues.push(`data directory: ${dataMode.toString(8)} (expected 700)`);
        await chmod(this.dataDir, 0o700);
        console.warn(`[Security] Fixed data directory permissions: ${this.dataDir}`);
      }

      const browserStateStats = await stat(this.browserStateDir).catch(() => null);
      if (browserStateStats) {
        const browserStateMode = browserStateStats.mode & 0o777;
        if (browserStateMode & 0o007) {
          issues.push(`browser_state directory: ${browserStateMode.toString(8)} (expected 700)`);
          await chmod(this.browserStateDir, 0o700);
          console.warn(`[Security] Fixed browser_state directory permissions: ${this.browserStateDir}`);
        }
      }

      const cacheStats = await stat(this.cacheDir).catch(() => null);
      if (cacheStats) {
        const cacheMode = cacheStats.mode & 0o777;
        if (cacheMode & 0o007) {
          issues.push(`cache directory: ${cacheMode.toString(8)} (expected 700)`);
          await chmod(this.cacheDir, 0o700);
          console.warn(`[Security] Fixed cache directory permissions: ${this.cacheDir}`);
        }
      }

      const sensitiveFiles = [
        this.stateFile,
        this.authInfoFile,
        this.cacheFile,
      ];

      for (const file of sensitiveFiles) {
        try {
          const fileStats = await stat(file);
          const fileMode = fileStats.mode & 0o777;

          if (fileMode & 0o077) {
            issues.push(`${file}: ${fileMode.toString(8)} (expected 600)`);
            await chmod(file, 0o600);
            console.warn(`[Security] Fixed file permissions: ${file}`);
          }
        } catch {
        }
      }

      if (issues.length > 0) {
        console.warn(`[Security] Found and fixed ${issues.length} insecure permission(s):`, issues.join(', '));
      }
    } catch (error) {
      console.error(`[Security] Error checking permissions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
